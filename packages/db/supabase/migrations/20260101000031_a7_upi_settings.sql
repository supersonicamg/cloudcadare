-- =============================================================================
-- a7_upi_settings.sql  —  save tenant_settings.commerce.upi (plan/16 §3.4)
-- tenant_settings is writable by people with tenant.settings.manage, but the people who set up payments hold
-- price.manage (finance), and the UPI ID decides where learners' money goes. So this one function is the door:
-- it needs price.manage AND the two-step check, accepts only the known keys, and writes an audit row (old and new).
-- =============================================================================

create or replace function public.save_upi_settings(p_tenant_id uuid, p_settings jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_old    jsonb;
  v_new    jsonb;
  v_keys   text[] := array['enabled', 'vpa', 'payee_name', 'qr_mode', 'static_qr_path', 'whatsapp_number', 'hours_text',
                           'sla_text', 'alert_email', 'alert_whatsapp', 'razorpay_coming_soon'];
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.has_perm(p_tenant_id, 'price.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select id into v_member from public.tenant_members where tenant_id = p_tenant_id and user_id = (select auth.uid()) and status = 'active';
  if v_member is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_settings) <> 'object' then raise exception 'invalid_settings' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_object_keys(p_settings) k where k <> all (v_keys)) then raise exception 'invalid_settings' using errcode = '22023'; end if;
  -- The one value that moves money gets a hard rule here too, not only in the app.
  if p_settings ? 'vpa' and (p_settings ->> 'vpa') !~ '^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$' then raise exception 'invalid_vpa' using errcode = '22023'; end if;
  if p_settings ? 'whatsapp_number' and coalesce(p_settings ->> 'whatsapp_number', '') <> '' and (p_settings ->> 'whatsapp_number') !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_whatsapp' using errcode = '22023';
  end if;

  select coalesce(commerce -> 'upi', '{}'::jsonb) into v_old from public.tenant_settings where tenant_id = p_tenant_id;
  v_new := coalesce(v_old, '{}'::jsonb) || p_settings;
  if coalesce(v_new ->> 'enabled', 'false') = 'true' and coalesce(v_new ->> 'vpa', '') = '' then raise exception 'vpa_required' using errcode = '22023'; end if;

  insert into public.tenant_settings (tenant_id, commerce) values (p_tenant_id, jsonb_build_object('upi', v_new))
  on conflict (tenant_id) do update set commerce = coalesce(public.tenant_settings.commerce, '{}'::jsonb) || jsonb_build_object('upi', v_new), updated_at = now();

  insert into public.audit_logs (tenant_id, actor_user_id, actor_member_id, action, entity_type, changes)
  values (p_tenant_id, (select auth.uid()), v_member, 'settings.upi_changed', 'tenant_settings', jsonb_build_object('before', v_old, 'after', v_new));
  return v_new;
end $$;

revoke all on function public.save_upi_settings(uuid, jsonb) from public, anon;
grant execute on function public.save_upi_settings(uuid, jsonb) to authenticated;

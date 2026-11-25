-- =============================================================================
-- 91_membership.sql  —  learner self-signup
-- Added in Phase 0 (not in the original plan SQL): after OTP login on an academy's site, a signed-in
-- user needs a safe way to become a member of THAT academy. Everything else on tenant_members is
-- denied to the client, so this SECURITY DEFINER function is the only door.
-- =============================================================================

create or replace function public.join_tenant(p_tenant_id uuid, p_display_name text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_t      public.tenants;
  v_open   boolean;
  v_member uuid;
  v_status text;
  v_email  text;
  v_phone  text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_t from public.tenants where id = p_tenant_id;
  if not found or v_t.status not in ('trial', 'active', 'past_due') then
    raise exception 'tenant_unavailable' using errcode = 'P0001';
  end if;

  -- Already a member: idempotent. A suspended member stays suspended (this must not be a way back in).
  select m.id, m.status into v_member, v_status
  from public.tenant_members m where m.tenant_id = p_tenant_id and m.user_id = v_uid;
  if found then
    if v_status in ('suspended', 'erased') then raise exception 'member_blocked' using errcode = '42501'; end if;
    return v_member;
  end if;

  -- Open signup is on unless the academy turned it off. Invitation-only academies use invitations.
  select coalesce((s.auth ->> 'open_signup')::boolean, true) into v_open
  from public.tenant_settings s where s.tenant_id = p_tenant_id;
  if not coalesce(v_open, true) then raise exception 'signup_closed' using errcode = 'P0001'; end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  -- phone comes from the verified JWT claim (Supabase puts it there for phone-OTP users)
  v_phone := nullif(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'phone', ''), '');

  insert into public.tenant_members (tenant_id, user_id, display_name, email, phone, status)
  values (p_tenant_id, v_uid,
          coalesce(nullif(trim(p_display_name), ''), nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'Learner'),
          v_email, v_phone, 'active')
  returning id into v_member;

  insert into public.member_roles (tenant_id, member_id, role_id)
  select p_tenant_id, v_member, r.id from public.roles r where r.tenant_id = p_tenant_id and r.key = 'student';

  return v_member;
end $$;

revoke execute on function public.join_tenant(uuid, text) from public, anon;
grant  execute on function public.join_tenant(uuid, text) to authenticated;

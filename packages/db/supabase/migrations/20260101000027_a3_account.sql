-- =============================================================================
-- a3_account.sql  —  learner account area (plan/16 §7)
--   update_my_profile : the only way a learner changes phone, city and the name printed on certificates.
--                       The column grant on tenant_members stays as it was (display_name, avatar_path, locale);
--                       custom_fields is never writable directly, so no learner can invent or overwrite other keys.
--   my_sessions / end_my_session : "Where you are logged in" (Supabase keeps sessions in the auth schema, which
--                       the Data API does not expose, so two small definer functions read and end the caller's own).
-- =============================================================================

create or replace function public.update_my_profile(
  p_tenant_id        uuid,
  p_display_name     text,
  p_phone            text,
  p_city             text,
  p_certificate_name text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_name   text := nullif(btrim(p_display_name), '');
  v_phone  text := nullif(btrim(p_phone), '');
  v_city   text := nullif(btrim(p_city), '');
  v_cert   text := nullif(btrim(p_certificate_name), '');
  v_locked boolean;
begin
  select m.id into v_member
  from public.tenant_members m
  where m.tenant_id = p_tenant_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if v_member is null then raise exception 'not_a_member' using errcode = '42501'; end if;

  if v_name is null or char_length(v_name) > 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_city is not null and char_length(v_city) > 60 then raise exception 'invalid_city' using errcode = '22023'; end if;
  if v_cert is not null and char_length(v_cert) > 80 then raise exception 'invalid_certificate_name' using errcode = '22023'; end if;

  -- The printed name is frozen by the first certificate. Ignore a changed value instead of failing the whole save.
  select exists (select 1 from public.certificates c where c.tenant_id = p_tenant_id and c.member_id = v_member) into v_locked;

  update public.tenant_members m
  set display_name = v_name,
      phone = v_phone,
      custom_fields = case
        when v_locked then m.custom_fields || jsonb_build_object('city', v_city)
        else m.custom_fields || jsonb_build_object('city', v_city, 'certificate_name', v_cert)
      end,
      updated_at = now()
  where m.id = v_member;

  return jsonb_build_object('certificate_name_locked', v_locked);
end $$;

revoke all on function public.update_my_profile(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(uuid, text, text, text, text) to authenticated;

create or replace function public.my_sessions()
returns table (id uuid, user_agent text, created_at timestamptz, last_seen timestamptz, is_current boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.user_agent, s.created_at, coalesce(s.refreshed_at, s.updated_at, s.created_at),
         s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
  from auth.sessions s
  where s.user_id = (select auth.uid()) and (s.not_after is null or s.not_after > now())
  order by 4 desc
$$;

revoke all on function public.my_sessions() from public, anon;
grant execute on function public.my_sessions() to authenticated;

create or replace function public.end_my_session(p_session_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  -- The current device is ended with Log out (it also clears the cookies), never from here.
  delete from auth.sessions s
  where s.id = p_session_id and s.user_id = (select auth.uid())
    and s.id is distinct from nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

revoke all on function public.end_my_session(uuid) from public, anon;
grant execute on function public.end_my_session(uuid) to authenticated;

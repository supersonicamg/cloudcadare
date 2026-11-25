-- =============================================================================
-- a4_email_codes.sql  —  confirm the email with a 6-digit code BEFORE anything is granted (plan/16 §4)
--
-- Why in the app and not Supabase's "Confirm email": with that switch OFF Supabase marks every address confirmed at
-- sign-up, so `email_confirmed_at` proves nothing, and the project has no mail server of its own. The whitelist grants
-- access by email alone, so the only safe proof is a code mailed to the address and typed back.
--
--   tenant_members.email_verified_at  : set only by verify_email_code. Nothing else may write it (learners hold
--                                       column grants for three other columns only).
--   email_verifications               : the codes. RLS on, no policy, no grant: only definer functions touch it.
--   issue_email_code(member)          : SERVICE ROLE ONLY. The app calls it, then mails the code. A code returned to
--                                       the browser would prove nothing, so no learner can call this.
--   verify_email_code(tenant, code)   : the learner types the code. 10 minutes, 5 tries, single use.
-- =============================================================================

alter table public.tenant_members add column email_verified_at timestamptz;

-- Accounts that already have access or a role were vetted another way; do not lock them out.
update public.tenant_members m
set email_verified_at = coalesce(m.joined_at, now())
where m.email_verified_at is null
  and (exists (select 1 from public.enrollments e where e.member_id = m.id)
       or exists (select 1 from public.member_roles r where r.member_id = m.id));

create table public.email_verifications (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null,
  member_id   uuid not null,
  email_norm  text not null,
  code        text not null check (code ~ '^[0-9]{6}$'),
  attempts    int  not null default 0,
  expires_at  timestamptz not null default now() + interval '10 minutes',
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);
create index email_verifications_member_idx on public.email_verifications (member_id, created_at desc);
alter table public.email_verifications enable row level security;
revoke all on public.email_verifications from anon, authenticated;

create or replace function public.issue_email_code(p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m      public.tenant_members;
  v_code   text;
  v_last   timestamptz;
  v_hour   int;
begin
  select * into v_m from public.tenant_members where id = p_member_id and status = 'active' for update;
  if not found or v_m.email is null then raise exception 'member_not_found' using errcode = 'P0002'; end if;
  if v_m.email_verified_at is not null then return jsonb_build_object('status', 'already_verified'); end if;

  select max(created_at), count(*) filter (where created_at > now() - interval '1 hour')
    into v_last, v_hour from public.email_verifications where member_id = p_member_id;
  if v_last is not null and v_last > now() - interval '60 seconds' then
    return jsonb_build_object('status', 'too_soon', 'retry_in', greatest(1, ceil(extract(epoch from (v_last + interval '60 seconds' - now())))::int));
  end if;
  if v_hour >= 4 then return jsonb_build_object('status', 'too_many'); end if;  -- the first code plus 3 resends per hour

  update public.email_verifications set used_at = now() where member_id = p_member_id and used_at is null;
  v_code := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
  insert into public.email_verifications (tenant_id, member_id, email_norm, code)
  values (v_m.tenant_id, v_m.id, lower(btrim(v_m.email::text)), v_code);
  return jsonb_build_object('status', 'issued', 'code', v_code, 'email', lower(btrim(v_m.email::text)), 'name', v_m.display_name);
end $$;

revoke all on function public.issue_email_code(uuid) from public, anon, authenticated;
grant execute on function public.issue_email_code(uuid) to service_role;

create or replace function public.verify_email_code(p_tenant_id uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.tenant_members;
  v_v public.email_verifications;
begin
  select * into v_m from public.tenant_members
  where tenant_id = p_tenant_id and user_id = (select auth.uid()) and status = 'active' for update;
  if not found then raise exception 'not_a_member' using errcode = '42501'; end if;
  if v_m.email_verified_at is not null then return jsonb_build_object('status', 'verified'); end if;

  select * into v_v from public.email_verifications
  where member_id = v_m.id and used_at is null order by created_at desc limit 1 for update;
  if not found or v_v.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if v_v.attempts >= 5 then return jsonb_build_object('status', 'locked'); end if;

  if btrim(p_code) is distinct from v_v.code then
    update public.email_verifications set attempts = attempts + 1 where id = v_v.id;
    return jsonb_build_object('status', 'wrong', 'attempts_left', 4 - v_v.attempts);
  end if;

  update public.email_verifications set used_at = now() where id = v_v.id;
  update public.tenant_members set email_verified_at = now(), updated_at = now() where id = v_m.id;
  return jsonb_build_object('status', 'verified');
end $$;

revoke all on function public.verify_email_code(uuid, text) from public, anon;
grant execute on function public.verify_email_code(uuid, text) to authenticated;

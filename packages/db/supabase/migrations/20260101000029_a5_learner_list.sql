-- =============================================================================
-- a5_learner_list.sql  —  the learner list ("whitelist"), plan/16 §3.2 and §4
-- People who already have CEAP (for example paid on the old site) are listed by email. When one of them signs up and
-- CONFIRMS that email (migration 28), they get access without paying. Matching is exact on lower(btrim(email)):
-- no wildcards, no Gmail dot tricks, no whole-domain entries.
--
--   access_whitelist                  : staff with enrollment.manage may read; nobody writes directly.
--   add_to_learner_list / remove_ / extend_ : staff only, need the two-step check (aal2) like grant_enrollment.
--   private.claim_whitelist(member)   : the one door that turns a row into an enrolment. Needs email_verified_at.
--   public.claim_my_list_access(t)    : lets a confirmed learner without access be checked again at log in, so a
--                                       row added later still works.
--   verify_email_code                 : now claims right after the email is confirmed and says what happened.
-- =============================================================================

create table public.access_whitelist (
  id            uuid primary key default private.uuid7(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  email_norm    text not null,
  full_name     text,
  course_id     uuid not null,
  batch_id      uuid,
  expires_at    timestamptz,
  status        text not null default 'waiting' check (status in ('waiting', 'claimed', 'expired', 'removed')),
  claimed_by    uuid,
  claimed_at    timestamptz,
  enrollment_id uuid,
  note          text,
  added_by      uuid not null,
  created_at    timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, email_norm, course_id),
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade,
  foreign key (tenant_id, batch_id)  references public.batches(tenant_id, id) on delete set null (batch_id),
  check (email_norm = lower(btrim(email_norm)) and email_norm like '%_@_%._%' and char_length(email_norm) <= 254)
);
create index access_whitelist_lookup_idx on public.access_whitelist (tenant_id, email_norm) where status = 'waiting';
create index access_whitelist_list_idx on public.access_whitelist (tenant_id, status, created_at desc);

alter table public.access_whitelist enable row level security;
create policy access_whitelist_staff_select on public.access_whitelist for select to authenticated
  using (tenant_id in (select private.perm_tenants('enrollment.manage')));
grant select on public.access_whitelist to authenticated;

-- ---------------------------------------------------------------- the claim
create or replace function private.claim_whitelist(p_member_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_m   public.tenant_members;
  v_w   public.access_whitelist;
  v_c   public.courses;
  v_enr uuid;
  v_exp timestamptz;
begin
  select * into v_m from public.tenant_members where id = p_member_id and status = 'active' for update;
  if not found or v_m.email is null then return 'not_listed'; end if;
  -- An email nobody has proven is never matched (plan/16 §4.1).
  if v_m.email_verified_at is null then return 'not_listed'; end if;

  select * into v_w from public.access_whitelist
  where tenant_id = v_m.tenant_id and email_norm = lower(btrim(v_m.email::text)) and status = 'waiting'
  order by created_at limit 1 for update;
  if not found then return 'not_listed'; end if;

  select * into v_c from public.courses where tenant_id = v_m.tenant_id and id = v_w.course_id and deleted_at is null;
  if not found then return 'not_listed'; end if;

  if exists (select 1 from public.enrollments e
             where e.member_id = v_m.id and e.course_id = v_w.course_id and e.status in ('active', 'paused')) then
    return 'already_enrolled';
  end if;

  v_exp := v_w.expires_at;
  if v_exp is not null and v_exp <= now() then
    update public.access_whitelist set status = 'expired' where id = v_w.id;
    return 'not_listed';
  end if;

  insert into public.enrollments (tenant_id, member_id, course_id, batch_id, source, status, started_at, expires_at, lessons_total)
  values (v_m.tenant_id, v_m.id, v_w.course_id, v_w.batch_id, 'import', 'active', now(), v_exp, v_c.lesson_count)
  returning id into v_enr;

  update public.access_whitelist
     set status = 'claimed', claimed_by = v_m.id, claimed_at = now(), enrollment_id = v_enr
   where id = v_w.id;

  insert into public.audit_logs (tenant_id, actor_user_id, actor_member_id, action, entity_type, entity_id, changes)
  values (v_m.tenant_id, v_m.user_id, v_m.id, 'learner_list.claimed', 'access_whitelist', v_w.id,
          jsonb_build_object('enrollment_id', v_enr, 'course_id', v_w.course_id));
  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_m.tenant_id, 'whitelist.claimed', 'enrollment', v_enr,
          jsonb_build_object('member_id', v_m.id, 'course_id', v_w.course_id));
  return 'claimed';
end $$;
revoke all on function private.claim_whitelist(uuid) from public, anon, authenticated;

create or replace function public.claim_my_list_access(p_tenant_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_member uuid;
begin
  select id into v_member from public.tenant_members
  where tenant_id = p_tenant_id and user_id = (select auth.uid()) and status = 'active';
  if v_member is null then raise exception 'not_a_member' using errcode = '42501'; end if;
  return private.claim_whitelist(v_member);
end $$;
revoke all on function public.claim_my_list_access(uuid) from public, anon;
grant execute on function public.claim_my_list_access(uuid) to authenticated;

-- verify_email_code: unchanged rules, plus the claim right after the email is confirmed.
create or replace function public.verify_email_code(p_tenant_id uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.tenant_members;
  v_v public.email_verifications;
begin
  select * into v_m from public.tenant_members
  where tenant_id = p_tenant_id and user_id = (select auth.uid()) and status = 'active' for update;
  if not found then raise exception 'not_a_member' using errcode = '42501'; end if;
  if v_m.email_verified_at is not null then
    return jsonb_build_object('status', 'verified', 'claim', private.claim_whitelist(v_m.id));
  end if;

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
  return jsonb_build_object('status', 'verified', 'claim', private.claim_whitelist(v_m.id));
end $$;

-- ---------------------------------------------------------------- staff: add, remove, extend
create or replace function private.require_list_staff(p_tenant uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_member uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.has_perm(p_tenant, 'enrollment.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select id into v_member from public.tenant_members where tenant_id = p_tenant and user_id = (select auth.uid()) and status = 'active';
  if v_member is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  return v_member;
end $$;
revoke all on function private.require_list_staff(uuid) from public, anon, authenticated;

/**
 * p_entries: [{"email": "...", "name": "..."}], at most 500. Never silent: the answer says, per address, what happened.
 * Blank p_expires = the batch's end date plus the academy's replay window (tenant_settings.learning.replay_months, default 6).
 * An address whose list row was removed or expired is put back on the list.
 */
create or replace function public.add_to_learner_list(
  p_tenant_id uuid, p_course_id uuid, p_batch_id uuid, p_expires timestamptz, p_entries jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff   uuid := private.require_list_staff(p_tenant_id);
  v_e       jsonb;
  v_email   text;
  v_name    text;
  v_exp     timestamptz := p_expires;
  v_months  int;
  v_end     date;
  v_row     public.access_whitelist;
  v_added   text[] := '{}';
  v_existing text[] := '{}';
  v_access  text[] := '{}';
  v_invalid text[] := '{}';
  v_seen    text[] := '{}';
begin
  if not exists (select 1 from public.courses c where c.tenant_id = p_tenant_id and c.id = p_course_id and c.deleted_at is null) then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then raise exception 'no_entries' using errcode = '22023'; end if;
  if jsonb_array_length(p_entries) > 500 then raise exception 'too_many_entries' using errcode = '22023'; end if;

  if v_exp is null and p_batch_id is not null then
    select b.end_date into v_end from public.batches b where b.tenant_id = p_tenant_id and b.id = p_batch_id;
    select coalesce(nullif(s.learning ->> 'replay_months', '')::int, 6) into v_months from public.tenant_settings s where s.tenant_id = p_tenant_id;
    if v_end is not null then v_exp := (v_end + make_interval(months => coalesce(v_months, 6)))::timestamptz; end if;
  end if;
  if v_exp is not null and v_exp <= now() then raise exception 'expiry_in_past' using errcode = '22023'; end if;

  for v_e in select * from jsonb_array_elements(p_entries) loop
    v_email := lower(btrim(coalesce(v_e ->> 'email', '')));
    v_name  := nullif(left(btrim(coalesce(v_e ->> 'name', '')), 120), '');
    if v_email !~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$' or char_length(v_email) > 254 then
      v_invalid := v_invalid || v_email; continue;
    end if;
    if v_email = any (v_seen) then continue; end if;   -- the same address twice in one paste
    v_seen := v_seen || v_email;

    if exists (select 1 from public.tenant_members m join public.enrollments e on e.member_id = m.id
               where m.tenant_id = p_tenant_id and lower(btrim(m.email::text)) = v_email and e.course_id = p_course_id
                 and e.status in ('active', 'paused', 'completed')) then
      v_access := v_access || v_email; continue;
    end if;

    select * into v_row from public.access_whitelist where tenant_id = p_tenant_id and email_norm = v_email and course_id = p_course_id for update;
    if found then
      if v_row.status in ('waiting', 'claimed') then v_existing := v_existing || v_email; continue; end if;
      update public.access_whitelist set status = 'waiting', batch_id = p_batch_id, expires_at = v_exp, full_name = coalesce(v_name, full_name),
             added_by = v_staff, claimed_by = null, claimed_at = null, enrollment_id = null where id = v_row.id;
    else
      insert into public.access_whitelist (tenant_id, email_norm, full_name, course_id, batch_id, expires_at, added_by)
      values (p_tenant_id, v_email, v_name, p_course_id, p_batch_id, v_exp, v_staff);
    end if;
    v_added := v_added || v_email;
  end loop;

  insert into public.audit_logs (tenant_id, actor_user_id, actor_member_id, action, entity_type, entity_id, changes)
  values (p_tenant_id, (select auth.uid()), v_staff, 'learner_list.added', 'course', p_course_id,
          jsonb_build_object('added', coalesce(array_length(v_added, 1), 0), 'existing', coalesce(array_length(v_existing, 1), 0),
                             'has_access', coalesce(array_length(v_access, 1), 0), 'invalid', coalesce(array_length(v_invalid, 1), 0)));
  return jsonb_build_object('added', to_jsonb(v_added), 'existing', to_jsonb(v_existing), 'has_access', to_jsonb(v_access),
                            'invalid', to_jsonb(v_invalid), 'expires_at', v_exp);
end $$;

create or replace function public.remove_from_learner_list(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_w public.access_whitelist; v_staff uuid;
begin
  select * into v_w from public.access_whitelist where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_staff := private.require_list_staff(v_w.tenant_id);
  -- A claimed row cannot be removed here: access is ended from Enrolments.
  if v_w.status <> 'waiting' then return v_w.status; end if;
  update public.access_whitelist set status = 'removed' where id = p_id;
  insert into public.audit_logs (tenant_id, actor_user_id, actor_member_id, action, entity_type, entity_id, changes)
  values (v_w.tenant_id, (select auth.uid()), v_staff, 'learner_list.removed', 'access_whitelist', p_id, jsonb_build_object('email', v_w.email_norm));
  return 'removed';
end $$;

create or replace function public.extend_learner_list_entry(p_id uuid, p_expires timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare v_w public.access_whitelist; v_staff uuid;
begin
  select * into v_w from public.access_whitelist where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_staff := private.require_list_staff(v_w.tenant_id);
  if p_expires is null or p_expires <= now() then raise exception 'expiry_in_past' using errcode = '22023'; end if;
  if v_w.status not in ('waiting', 'expired', 'removed') then return v_w.status; end if;
  update public.access_whitelist set status = 'waiting', expires_at = p_expires where id = p_id;
  insert into public.audit_logs (tenant_id, actor_user_id, actor_member_id, action, entity_type, entity_id, changes)
  values (v_w.tenant_id, (select auth.uid()), v_staff, 'learner_list.extended', 'access_whitelist', p_id,
          jsonb_build_object('expires_at', jsonb_build_array(v_w.expires_at, p_expires)));
  return 'waiting';
end $$;

revoke all on function public.add_to_learner_list(uuid, uuid, uuid, timestamptz, jsonb), public.remove_from_learner_list(uuid),
  public.extend_learner_list_entry(uuid, timestamptz) from public, anon;
grant execute on function public.add_to_learner_list(uuid, uuid, uuid, timestamptz, jsonb), public.remove_from_learner_list(uuid),
  public.extend_learner_list_entry(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------- the "you are in" email
insert into public.notification_templates (tenant_id, event_key, channel, subject, body) values
  (null, 'whitelist.claimed', 'email', 'You are in: {{course.title}} is unlocked',
   E'Hi {{member.name}},\n\nYour email was on our learner list, so {{course.title}} is already unlocked. There is nothing to pay.\n\nStart learning: {{links.learn}}')
on conflict do nothing;
insert into public.notification_templates (tenant_id, event_key, channel, subject, body)
select t.id, g.event_key, g.channel, g.subject, g.body
from public.tenants t cross join public.notification_templates g
where g.tenant_id is null and g.event_key = 'whitelist.claimed'
on conflict do nothing;

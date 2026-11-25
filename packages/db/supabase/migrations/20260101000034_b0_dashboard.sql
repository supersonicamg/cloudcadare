-- =============================================================================
-- b0_dashboard.sql  —  the Dashboard (plan/16 §12)
--  A learner-list match is no longer claimed on its own. The dashboard shows "You seem to be in the current batch" and
--  the learner presses "Join my batch now" (public.claim_my_list_access, unchanged in name and rights).
--
--   public.my_list_match(t)  : what the caller may claim, from their OWN confirmed email. Learners cannot read the list.
--   private.claim_whitelist  : same rules, but an old expired row no longer hides a newer valid one, and joining a
--                              running batch counts from the batch's start date.
--   public.verify_email_code : confirms the email and only REPORTS the match ('listed'); it creates no enrolment.
-- =============================================================================

create or replace function private.claim_whitelist(p_member_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_m   public.tenant_members;
  v_w   public.access_whitelist;
  v_c   public.courses;
  v_enr uuid;
  v_from timestamptz;
begin
  select * into v_m from public.tenant_members where id = p_member_id and status = 'active' for update;
  if not found or v_m.email is null then return 'not_listed'; end if;
  -- An email nobody has proven is never matched (plan/16 §4.1).
  if v_m.email_verified_at is null then return 'not_listed'; end if;

  update public.access_whitelist set status = 'expired'
   where tenant_id = v_m.tenant_id and email_norm = lower(btrim(v_m.email::text)) and status = 'waiting'
     and expires_at is not null and expires_at <= now();

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

  -- Someone joining a batch that is already running starts when the batch did, so the months that have opened for the
  -- batch are open for them too ("days after enrolment" unlock rules count from here).
  select b.start_date::timestamp at time zone 'Asia/Kolkata' into v_from
  from public.batches b where b.tenant_id = v_m.tenant_id and b.id = v_w.batch_id;

  insert into public.enrollments (tenant_id, member_id, course_id, batch_id, source, status, started_at, expires_at, lessons_total)
  values (v_m.tenant_id, v_m.id, v_w.course_id, v_w.batch_id, 'import', 'active', least(coalesce(v_from, now()), now()), v_w.expires_at, v_c.lesson_count)
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

-- Read only: null when there is nothing to claim. Answers only about the caller's own confirmed address.
create or replace function public.my_list_match(p_tenant_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_m public.tenant_members;
  v_r jsonb;
begin
  select * into v_m from public.tenant_members
  where tenant_id = p_tenant_id and user_id = (select auth.uid()) and status = 'active';
  if not found then raise exception 'not_a_member' using errcode = '42501'; end if;
  if v_m.email is null or v_m.email_verified_at is null then return null; end if;

  select jsonb_build_object(
           'email', w.email_norm, 'course_id', c.id, 'course_slug', c.slug, 'course_title', c.title,
           'batch_id', b.id, 'batch_name', b.name, 'batch_status', b.status, 'batch_start', b.start_date)
    into v_r
  from public.access_whitelist w
  join public.courses c on c.tenant_id = w.tenant_id and c.id = w.course_id and c.deleted_at is null
  left join public.batches b on b.tenant_id = w.tenant_id and b.id = w.batch_id
  where w.tenant_id = p_tenant_id and w.email_norm = lower(btrim(v_m.email::text)) and w.status = 'waiting'
    and (w.expires_at is null or w.expires_at > now())
    and not exists (select 1 from public.enrollments e
                    where e.member_id = v_m.id and e.course_id = w.course_id and e.status in ('active', 'paused'))
  order by w.created_at limit 1;
  return v_r;
end $$;
revoke all on function public.my_list_match(uuid) from public, anon;
grant execute on function public.my_list_match(uuid) to authenticated;

create or replace function public.verify_email_code(p_tenant_id uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.tenant_members;
  v_v public.email_verifications;
begin
  select * into v_m from public.tenant_members
  where tenant_id = p_tenant_id and user_id = (select auth.uid()) and status = 'active' for update;
  if not found then raise exception 'not_a_member' using errcode = '42501'; end if;

  if v_m.email_verified_at is null then
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
  end if;

  return jsonb_build_object('status', 'verified', 'claim',
    case
      when public.my_list_match(p_tenant_id) is not null then 'listed'
      when exists (select 1 from public.enrollments e where e.member_id = v_m.id and e.status in ('active', 'paused')) then 'already_enrolled'
      else 'not_listed'
    end);
end $$;

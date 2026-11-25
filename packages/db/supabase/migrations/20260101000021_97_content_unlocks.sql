-- =============================================================================
-- 97_content_unlocks.sql  —  sequential courses and drip unlock
-- Added in Phase 1 slice 5.
--   courses.settings.sequential = true       : a lesson opens only when every earlier required lesson is done
--   lessons.unlock_rule = {"type":"days_after_enrolment","days":N} : a lesson opens N days after the learner enrolled
-- The rules live here once. The learner screens read them through my_lesson_locks(); record_lesson_progress
-- refuses a locked lesson, so a hand-made request cannot skip ahead.
-- "Earlier" means section position, then lesson position (the admin editor only makes top-level sections).
-- =============================================================================

create or replace function private.lesson_locks(p_enrollment_id uuid)
returns table (lesson_id uuid, reason text, blocking_lesson_id uuid, unlocks_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with e as (
    select en.* from public.enrollments en where en.id = p_enrollment_id
  ),
  course as (
    select c.id, coalesce((c.settings ->> 'sequential')::boolean, false) as sequential from public.courses c join e on e.course_id = c.id
  ),
  ordered as (
    select l.id, l.is_mandatory, l.unlock_rule,
           row_number() over (order by s.position, l.position, l.created_at) as rn,
           (lp.status = 'completed') as done
    from public.lessons l
    join public.course_sections s on s.id = l.section_id and s.deleted_at is null and s.is_published
    join e on e.course_id = l.course_id
    left join public.lesson_progress lp on lp.enrollment_id = e.id and lp.lesson_id = l.id
    where l.is_published and l.deleted_at is null
  ),
  judged as (
    select o.id,
           case when coalesce(o.unlock_rule ->> 'type', 'always') = 'days_after_enrolment'
                then e.started_at + make_interval(days => coalesce((o.unlock_rule ->> 'days')::int, 0)) end as drip_at,
           (select p.id from ordered p where (select sequential from course) and p.rn < o.rn and p.is_mandatory and not coalesce(p.done, false) order by p.rn limit 1) as blocker
    from ordered o cross join e
    where not coalesce(o.done, false)
  )
  select j.id,
         case when j.drip_at is not null and j.drip_at > now() then 'drip' else 'sequential' end,
         case when j.drip_at is not null and j.drip_at > now() then null else j.blocker end,
         case when j.drip_at is not null and j.drip_at > now() then j.drip_at end
  from judged j
  where (j.drip_at is not null and j.drip_at > now()) or j.blocker is not null
$$;

-- The caller's own locked lessons in a course (empty when they are not enrolled or nothing is locked).
create or replace function public.my_lesson_locks(p_course_id uuid)
returns table (lesson_id uuid, reason text, blocking_lesson_id uuid, unlocks_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.*
  from public.enrollments e
  join public.tenant_members m on m.id = e.member_id and m.user_id = (select auth.uid())
  cross join lateral private.lesson_locks(e.id) k
  where e.course_id = p_course_id and e.status in ('active', 'completed') and (e.expires_at is null or e.expires_at > now())
$$;

revoke execute on function private.lesson_locks(uuid) from public;
revoke execute on function public.my_lesson_locks(uuid) from public, anon;
grant  execute on function public.my_lesson_locks(uuid) to authenticated;

create or replace function public.record_lesson_progress(
  p_lesson_id        uuid,
  p_position_seconds int     default null,
  p_delta_seconds    int     default 0,
  p_progress_pct     numeric default null,
  p_mark_complete    boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_lesson     public.lessons;
  v_member     uuid;
  v_enrollment public.enrollments;
  v_prev       text;
  v_rule       text;
  v_threshold  numeric;
  v_pct        numeric := least(greatest(coalesce(p_progress_pct, 0), 0), 100);
  v_delta      int     := least(greatest(coalesce(p_delta_seconds, 0), 0), 120);
  v_complete   boolean := false;
  v_newly      boolean := false;
begin
  select * into v_lesson from public.lessons
  where id = p_lesson_id and is_published and deleted_at is null;
  if not found then raise exception 'lesson_not_found' using errcode = 'P0002'; end if;

  select m.id into v_member from public.tenant_members m
  where m.tenant_id = v_lesson.tenant_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if v_member is null then raise exception 'not_a_member' using errcode = '42501'; end if;

  if not private.feature_enabled(v_lesson.tenant_id, 'learning.progress') then
    return jsonb_build_object('tracked', false);
  end if;

  select * into v_enrollment from public.enrollments e
  where e.tenant_id = v_lesson.tenant_id and e.member_id = v_member and e.course_id = v_lesson.course_id
    and e.status in ('active', 'completed') and (e.expires_at is null or e.expires_at > now())
  for update;
  if not found then raise exception 'not_enrolled' using errcode = '42501'; end if;

  -- sequential courses and drip schedules: a locked lesson cannot be progressed
  if exists (select 1 from private.lesson_locks(v_enrollment.id) k where k.lesson_id = p_lesson_id) then
    raise exception 'lesson_locked' using errcode = 'P0001';
  end if;

  v_rule      := coalesce(v_lesson.completion_rule ->> 'type', 'auto');
  v_threshold := coalesce((v_lesson.completion_rule ->> 'pct')::numeric, 90);
  v_complete  := case v_rule
    when 'auto'      then case when v_lesson.type in ('video', 'audio') then v_pct >= v_threshold
                               when v_lesson.type in ('quiz', 'test', 'assignment', 'live') then false
                               else true end
    when 'view'      then true
    when 'watch_pct' then v_pct >= v_threshold
    when 'manual'    then coalesce(p_mark_complete, false)
    else false            -- pass_test / submit_assignment are completed by grading
  end;

  select lp.status into v_prev from public.lesson_progress lp
  where lp.enrollment_id = v_enrollment.id and lp.lesson_id = p_lesson_id;

  insert into public.lesson_progress as lp
    (tenant_id, enrollment_id, lesson_id, member_id, course_id, status, progress_pct,
     last_position_seconds, time_spent_seconds, completed_at)
  values
    (v_lesson.tenant_id, v_enrollment.id, p_lesson_id, v_member, v_lesson.course_id,
     case when v_complete then 'completed' else 'in_progress' end, v_pct,
     coalesce(p_position_seconds, 0), v_delta, case when v_complete then now() end)
  on conflict (enrollment_id, lesson_id) do update set
    progress_pct          = greatest(lp.progress_pct, excluded.progress_pct),
    last_position_seconds = coalesce(p_position_seconds, lp.last_position_seconds),
    time_spent_seconds    = lp.time_spent_seconds + v_delta,
    view_count            = lp.view_count + case when lp.last_viewed_at < now() - interval '30 minutes' then 1 else 0 end,
    last_viewed_at        = now(),
    status                = case when lp.status = 'completed' or v_complete then 'completed' else 'in_progress' end,
    completed_at          = coalesce(lp.completed_at, case when v_complete then now() end);

  v_newly := v_complete and v_prev is distinct from 'completed';

  update public.enrollments
     set total_time_seconds = total_time_seconds + v_delta,
         last_activity_at   = now(),
         last_lesson_id     = p_lesson_id
   where id = v_enrollment.id;

  if v_newly then
    perform private.complete_lesson_effects(v_enrollment, v_lesson);
  end if;

  perform private.touch_daily_activity(v_lesson.tenant_id, v_member, v_delta, case when v_newly then 1 else 0 end, 0);

  return jsonb_build_object(
    'tracked', true,
    'completed', v_complete or v_prev = 'completed',
    'newly_completed', v_newly,
    'course_progress_pct', (select progress_pct from public.enrollments where id = v_enrollment.id)
  );
end $$;

revoke execute on function public.record_lesson_progress(uuid, int, int, numeric, boolean) from public, anon;
grant  execute on function public.record_lesson_progress(uuid, int, int, numeric, boolean) to authenticated;

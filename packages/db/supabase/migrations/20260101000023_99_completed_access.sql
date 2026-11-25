-- =============================================================================
-- 99_completed_access.sql  —  a finished course stays open for review
-- private.my_course_ids() (used by the lessons RLS policy) only counted enrollments with status 'active'. When the
-- last required lesson was completed the enrollment became 'completed' and the learner lost access to every lesson
-- of the course (the dashboard even offered "Review"). Completed enrollments keep access until they expire;
-- cancelled, refunded, expired and paused ones do not.
-- =============================================================================
create or replace function private.my_course_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.course_id from public.enrollments e
  where e.member_id in (select private.my_member_ids())
    and e.status in ('active', 'completed') and (e.expires_at is null or e.expires_at > now())
$$;

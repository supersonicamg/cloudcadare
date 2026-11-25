-- =============================================================================
-- 93_enrolment.sql  —  learner self-enrolment on open courses
-- Added in Phase 1 (not in the original plan SQL). Enrolments have no client write policy, so this
-- SECURITY DEFINER function is the only door for a learner. It opens only when ALL of these hold:
--   * the course is published, not deleted and not private;
--   * the academy switched enrolment to "open" on that course (courses.settings.enrolment = 'open'),
--     which is off by default so a paid course never becomes free by accident;
--   * no product sells the course (once commerce exists, access comes from fulfilment, not from here).
-- Paid and admin-granted enrolments are created by the privileged fulfilment path (Phase 1, slice 3).
-- =============================================================================

create or replace function public.enroll_in_course(p_course_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_course public.courses;
  v_member uuid;
  v_enr    uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_course from public.courses c
  where c.id = p_course_id and c.status = 'published' and c.deleted_at is null and c.visibility in ('public', 'unlisted');
  if not found then raise exception 'course_not_found' using errcode = 'P0002'; end if;

  select m.id into v_member from public.tenant_members m
  where m.tenant_id = v_course.tenant_id and m.user_id = v_uid and m.status = 'active';
  if v_member is null then raise exception 'not_a_member' using errcode = '42501'; end if;

  -- Idempotent: an existing live or finished enrolment is returned as is.
  select e.id into v_enr from public.enrollments e
  where e.tenant_id = v_course.tenant_id and e.member_id = v_member and e.course_id = v_course.id
    and e.status in ('active', 'paused', 'completed')
  order by e.started_at desc limit 1;
  if found then return v_enr; end if;

  if not private.feature_enabled(v_course.tenant_id, 'catalog.courses')
     or coalesce(v_course.settings ->> 'enrolment', 'closed') <> 'open'
     or exists (select 1 from public.product_items pi
                join public.products p on p.id = pi.product_id and p.deleted_at is null and p.status <> 'archived'
                where pi.course_id = v_course.id) then
    raise exception 'enrolment_closed' using errcode = 'P0001';
  end if;

  insert into public.enrollments (tenant_id, member_id, course_id, source, expires_at, lessons_total)
  values (v_course.tenant_id, v_member, v_course.id, 'free',
          case when v_course.access_duration_days is not null then now() + make_interval(days => v_course.access_duration_days) end,
          v_course.lesson_count)
  returning id into v_enr;

  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_course.tenant_id, 'enrollment.created', 'enrollment', v_enr,
          jsonb_build_object('member_id', v_member, 'course_id', v_course.id, 'source', 'free'));
  return v_enr;
end $$;

revoke execute on function public.enroll_in_course(uuid) from public, anon;
grant  execute on function public.enroll_in_course(uuid) to authenticated;

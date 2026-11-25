-- =============================================================================
-- 94_enrolment_admin.sql  —  staff grant and revoke access
-- Added in Phase 1. Enrolments have no client write policy; staff go through these two SECURITY DEFINER
-- functions. Both need the tenant-wide `enrollment.manage` permission AND an MFA session (aal2), always:
-- the app's DAL demands aal2 for sensitive permissions, and a staff token must not be able to skip that by
-- calling the API directly (private.perm_tenants only checks aal when the tenant turned the setting on).
-- =============================================================================

create or replace function public.grant_enrollment(p_member_id uuid, p_course_id uuid, p_expires_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_course public.courses;
  v_member public.tenant_members;
  v_enr    uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_course from public.courses c where c.id = p_course_id and c.deleted_at is null;
  if not found then raise exception 'course_not_found' using errcode = 'P0002'; end if;
  if not private.has_perm(v_course.tenant_id, 'enrollment.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select * into v_member from public.tenant_members m
  where m.id = p_member_id and m.tenant_id = v_course.tenant_id and m.status = 'active';
  if not found then raise exception 'member_not_found' using errcode = 'P0002'; end if;

  select e.id into v_enr from public.enrollments e
  where e.tenant_id = v_course.tenant_id and e.member_id = p_member_id and e.course_id = p_course_id
    and e.status in ('active', 'paused', 'completed')
  order by e.started_at desc limit 1;
  if found then return v_enr; end if;

  insert into public.enrollments (tenant_id, member_id, course_id, source, expires_at, lessons_total)
  values (v_course.tenant_id, p_member_id, p_course_id, 'admin',
          coalesce(p_expires_at, case when v_course.access_duration_days is not null then now() + make_interval(days => v_course.access_duration_days) end),
          v_course.lesson_count)
  returning id into v_enr;

  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_course.tenant_id, 'enrollment.created', 'enrollment', v_enr,
          jsonb_build_object('member_id', p_member_id, 'course_id', p_course_id, 'source', 'admin'));
  return v_enr;
end $$;

create or replace function public.revoke_enrollment(p_enrollment_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.enrollments;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_e from public.enrollments e where e.id = p_enrollment_id;
  if not found then raise exception 'enrollment_not_found' using errcode = 'P0002'; end if;
  if not private.has_perm(v_e.tenant_id, 'enrollment.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  update public.enrollments
     set status = 'cancelled', notes = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_enrollment_id and status in ('active', 'paused', 'completed');

  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_e.tenant_id, 'enrollment.revoked', 'enrollment', p_enrollment_id,
          jsonb_build_object('member_id', v_e.member_id, 'course_id', v_e.course_id));
end $$;

revoke execute on function public.grant_enrollment(uuid, uuid, timestamptz), public.revoke_enrollment(uuid, text) from public, anon;
grant  execute on function public.grant_enrollment(uuid, uuid, timestamptz), public.revoke_enrollment(uuid, text) to authenticated;

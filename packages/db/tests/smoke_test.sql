-- =============================================================================
-- tests/smoke_test.sql — end-to-end validation of the schema on a scratch DB.
-- Run as `postgres` after applying 00 → 99:
--   psql -v ON_ERROR_STOP=1 -f tests/smoke_test.sql
-- Every check raises an exception on failure; success prints "PASS …" notices.
-- In CI this becomes a pgTAP suite (supabase test db).
-- =============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

-- ------------------------------------------------------------------ actors
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'student-a@example.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'faculty-a@example.com');

-- ------------------------------------------------- distributor issues keys
insert into control.license_keys (distributor_id, plan_id, key_hash, key_hint, vertical_key, term_days)
select d.id, p.id, sha256(convert_to('EDU-TEST-AAAA-0001', 'UTF8')), 'EDU-TEST…0001', 'cloud_training', 365
from control.distributors d join control.plans p on p.distributor_id = d.id and p.code = 'growth' where d.kind = 'platform';
insert into control.license_keys (distributor_id, plan_id, key_hash, key_hint, vertical_key, term_days)
select d.id, p.id, sha256(convert_to('EDU-TEST-BBBB-0002', 'UTF8')), 'EDU-TEST…0002', 'neet_jee', 365
from control.distributors d join control.plans p on p.distributor_id = d.id and p.code = 'pro' where d.kind = 'platform';

-- -------------------------------------------- customers redeem & provision
select control.redeem_license(' edu-test-aaaa-0001 ', '00000000-0000-0000-0000-0000000000a1', 'cloudcadre', 'CloudCadre Academy') as ta \gset
select control.redeem_license('EDU-TEST-BBBB-0002', '00000000-0000-0000-0000-0000000000b1', 'rankers-neet', 'Rankers NEET') as tb \gset
select control.provision_local(:'ta', 'Owner A') as owner_a \gset
select control.provision_local(:'tb', 'Owner B') as owner_b \gset

do $$ begin
  if (select status from control.license_keys where key_hint = 'EDU-TEST…0001') <> 'exhausted' then raise exception 'license not exhausted'; end if;
  begin
    perform control.redeem_license('EDU-TEST-AAAA-0001', '00000000-0000-0000-0000-0000000000b1', 'second-try', 'X');
    raise exception 'reused license accepted';
  exception when others then
    if sqlerrm not like 'license_%' then raise; end if;
  end;
  raise notice 'PASS license redemption is single-use';
end $$;

-- ------------------------------------------------------------ entitlements
do $$
declare ta uuid := (select id from control.tenants where slug = 'cloudcadre');
        tb uuid := (select id from control.tenants where slug = 'rankers-neet');
begin
  if not private.feature_enabled(ta, 'learning.progress')   then raise exception 'growth should include progress'; end if;
  if     private.feature_enabled(ta, 'cohort.batches')      then raise exception 'growth must not include batches'; end if;
  if not private.feature_enabled(tb, 'cohort.batches')      then raise exception 'pro should include batches'; end if;
  if private.feature_limit(ta, 'limit.members') <> 2000     then raise exception 'growth member limit wrong'; end if;
  if private.feature_limit(tb, 'limit.courses') is not null then raise exception 'pro courses should be unlimited'; end if;
  if (select hostname from control.tenant_domains where tenant_id = ta) <> 'cloudcadre.yourplatform.app' then raise exception 'subdomain'; end if;

  -- distributor switches gamification OFF for B → leaderboards & badges must follow (dependency)
  insert into control.tenant_feature_overrides (tenant_id, feature_key, enabled, reason) values (tb, 'engage.gamification', false, 'test');
  perform control.sync_tenant_local(tb);
  if private.feature_enabled(tb, 'engage.leaderboards') then raise exception 'dependency not applied'; end if;
  if (select source from control.tenant_entitlements where tenant_id = tb and feature_key = 'engage.badges') <> 'dependency' then raise exception 'dependency source'; end if;
  delete from control.tenant_feature_overrides where tenant_id = tb;
  perform control.sync_tenant_local(tb);
  if not private.feature_enabled(tb, 'engage.leaderboards') then raise exception 'override removal not applied'; end if;

  -- add-on raises a limit
  insert into control.tenant_addons (tenant_id, addon_id, quantity)
  select ta, id, 2 from control.addons where code = 'members_1000';
  perform control.sync_tenant_local(ta);
  if private.feature_limit(ta, 'limit.members') <> 4000 then raise exception 'addon limit not applied: %', private.feature_limit(ta, 'limit.members'); end if;

  -- tenant admin turned a module off (vertical cloud_training disables offline payments)
  if not exists (select 1 from public.tenant_modules where tenant_id = ta and feature_key = 'commerce.offline_payments' and not is_enabled) then
    raise exception 'vertical disabled_modules not applied';
  end if;
  raise notice 'PASS entitlements: plan, add-on, override, dependency, vertical defaults';
end $$;

-- ---------------------------------------------- academy A builds content
insert into public.courses (tenant_id, slug, title, status, published_at, settings)
values (:'ta', 'aws-saa', 'AWS Solutions Architect', 'published', now(), '{"completion_threshold_pct":100}')
returning id as course_id \gset
insert into public.course_sections (tenant_id, course_id, label, title, position, is_published)
values (:'ta', :'course_id', 'Phase 1', 'Foundations', 1, true) returning id as section_id \gset
insert into public.lessons (tenant_id, course_id, section_id, type, title, position, xp_points, is_published, completion_rule)
values (:'ta', :'course_id', :'section_id', 'video', 'IAM deep dive', 1, 10, true, '{"type":"watch_pct","pct":90}') returning id as l_video \gset
insert into public.lessons (tenant_id, course_id, section_id, type, title, position, xp_points, is_published)
values (:'ta', :'course_id', :'section_id', 'pdf', 'VPC cheat sheet', 2, 5, true) returning id as l_pdf \gset

insert into public.tests (tenant_id, course_id, kind, title, status, duration_seconds, negative_marking, pass_marks)
values (:'ta', :'course_id', 'quiz', 'Phase 1 check', 'published', 600, true, 4) returning id as test_id \gset
insert into public.questions (tenant_id, type, stem, options, status, default_marks, default_negative_marks) values
  (:'ta', 'mcq_single', '{"text":"Which service is global?"}', '[{"id":"a","content":"EC2"},{"id":"b","content":"IAM"}]', 'approved', 4, 1)
returning id as q1 \gset
insert into public.questions (tenant_id, type, stem, options, status, default_marks, default_negative_marks) values
  (:'ta', 'mcq_multi', '{"text":"Pick storage services"}', '[{"id":"a","content":"S3"},{"id":"b","content":"EBS"},{"id":"c","content":"SQS"}]', 'approved', 4, 1)
returning id as q2 \gset
insert into public.questions (tenant_id, type, stem, status, default_marks, default_negative_marks) values
  (:'ta', 'numeric', '{"text":"How many AZs minimum for HA?"}', 'approved', 4, 1)
returning id as q3 \gset
insert into public.question_keys (tenant_id, question_id, answer) values
  (:'ta', :'q1', '{"correct":["b"]}'), (:'ta', :'q2', '{"correct":["a","b"]}'), (:'ta', :'q3', '{"value":2,"tolerance":0}');
insert into public.test_questions (tenant_id, test_id, question_id, position) values
  (:'ta', :'test_id', :'q1', 1), (:'ta', :'test_id', :'q2', 2), (:'ta', :'test_id', :'q3', 3);
update public.tests set total_marks = 12 where id = :'test_id';

-- learner joins & is enrolled
insert into public.tenant_members (tenant_id, user_id, display_name, email)
values (:'ta', '00000000-0000-0000-0000-0000000000a2', 'Student A', 'student-a@example.com') returning id as student \gset
insert into public.member_roles (tenant_id, member_id, role_id)
select :'ta', :'student', id from public.roles where tenant_id = :'ta' and key = 'student';
insert into public.enrollments (tenant_id, member_id, course_id, source) values (:'ta', :'student', :'course_id', 'admin') returning id as enr \gset

-- faculty with a role scoped to nothing but course view
insert into public.tenant_members (tenant_id, user_id, display_name) values (:'ta', '00000000-0000-0000-0000-0000000000a3', 'Faculty A') returning id as faculty \gset
insert into public.member_roles (tenant_id, member_id, role_id)
select :'ta', :'faculty', id from public.roles where tenant_id = :'ta' and key = 'instructor';

-- B builds a course too
insert into public.courses (tenant_id, slug, title, status, published_at) values (:'tb', 'neet-bio', 'NEET Biology', 'published', now());

-- ================================================== act as STUDENT A
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal1"}', false);

do $$
declare r jsonb; v_paper jsonb; v_attempt uuid; v_res jsonb;
        v_test uuid := (select id from public.tests limit 1);
begin
  -- isolation
  if (select count(*) from public.courses) <> 1 then raise exception 'student sees % courses (expected 1)', (select count(*) from public.courses); end if;
  if (select count(*) from public.tenants) <> 1 then raise exception 'student sees other tenants'; end if;
  if (select count(*) from public.tenant_members) <> 1 then raise exception 'student sees other members'; end if;
  raise notice 'PASS RLS: learner sees only own tenant, own member row';

  -- secrets
  perform 1 from public.question_keys;
  if found then raise exception 'question_keys visible to learner'; end if;
  begin perform 1 from public.questions limit 1;
    if found then raise exception 'questions readable by learner'; end if;
  exception when insufficient_privilege then null; end;
  begin insert into public.payments (tenant_id, order_id, gateway, amount_minor, status)
        values (gen_random_uuid(), gen_random_uuid(), 'cash', 100, 'captured');
        raise exception 'learner inserted a payment';
  exception when insufficient_privilege then null; end;
  begin update public.enrollments set progress_pct = 100; raise exception 'learner updated enrollment';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS RLS: answer keys, payments, enrollment writes are blocked';

  -- progress
  r := public.record_lesson_progress((select id from public.lessons where type = 'video'), 300, 500, 50);
  if (r ->> 'completed')::boolean then raise exception 'video completed at 50%%'; end if;
  r := public.record_lesson_progress((select id from public.lessons where type = 'video'), 580, 60, 95);
  if not (r ->> 'newly_completed')::boolean or (r ->> 'course_progress_pct')::numeric <> 50 then raise exception 'video completion: %', r; end if;
  r := public.record_lesson_progress((select id from public.lessons where type = 'pdf'));
  if (r ->> 'course_progress_pct')::numeric <> 100 then raise exception 'course should be 100%%: %', r; end if;
  if (select status from public.enrollments) <> 'completed' then raise exception 'enrollment not completed'; end if;
  if (select time_spent_seconds from public.lesson_progress where lesson_id = (select id from public.lessons where type = 'video')) <> 180 then
    raise exception 'time delta cap not applied';
  end if;
  raise notice 'PASS progress: watch-%% rule, delta cap, course completion';

  -- test engine
  v_attempt := public.start_test_attempt(v_test);
  v_paper   := public.get_attempt_paper(v_attempt);
  if v_paper::text like '%correct%' then raise exception 'paper leaks answer key'; end if;
  if jsonb_array_length(v_paper -> 'questions') <> 3 then raise exception 'paper size'; end if;
  perform public.save_attempt_answer(v_attempt, (select (q ->> 'id')::uuid from jsonb_array_elements(v_paper -> 'questions') q where q ->> 'type' = 'mcq_single'), '{"selected":"b"}');
  perform public.save_attempt_answer(v_attempt, (select (q ->> 'id')::uuid from jsonb_array_elements(v_paper -> 'questions') q where q ->> 'type' = 'mcq_multi'),  '{"selected":["a"]}');
  perform public.save_attempt_answer(v_attempt, (select (q ->> 'id')::uuid from jsonb_array_elements(v_paper -> 'questions') q where q ->> 'type' = 'numeric'),    '{"value":"3"}');
  begin perform public.save_attempt_answer(v_attempt, gen_random_uuid(), '{"selected":"a"}'); raise exception 'foreign question accepted';
  exception when others then if sqlerrm <> 'question_not_in_paper' then raise; end if; end;
  v_res := public.submit_test_attempt(v_attempt);
  -- +4 (correct) −1 (multi wrong, no partial) −1 (numeric wrong) = 2
  if (v_res ->> 'score')::numeric <> 2 or (v_res ->> 'correct')::int <> 1 or (v_res ->> 'is_passed')::boolean then
    raise exception 'grading wrong: %', v_res;
  end if;
  if public.start_test_attempt(v_test) = v_attempt then raise exception 'closed attempt resumed'; end if;
  raise notice 'PASS assessment: paper w/o keys, autosave guard, negative marking, pass/fail';

  -- gamification
  if (select xp_total from public.member_stats) <> 115 then  -- 10 video + 5 pdf + 100 course completion
    raise exception 'xp total = %', (select xp_total from public.member_stats);
  end if;
  if (select current_streak from public.member_stats) <> 1 then raise exception 'streak'; end if;
  raise notice 'PASS gamification: XP ledger → member_stats, streak';
end $$;

reset role;

-- ================================================== act as OWNER B (other tenant)
select set_config('test.ta', :'ta', false);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
do $$ begin
  if exists (select 1 from public.courses c join public.tenants t on t.id = c.tenant_id where t.slug = 'cloudcadre') then raise exception 'B sees A courses'; end if;
  if (select count(*) from public.courses) <> 1 then raise exception 'B course count'; end if;
  if exists (select 1 from public.enrollments) then raise exception 'B sees A enrollments'; end if;
  if exists (select 1 from public.test_attempts) then raise exception 'B sees A attempts'; end if;
  begin
    insert into public.courses (tenant_id, slug, title) values (current_setting('test.ta')::uuid, 'evil', 'x');
    raise exception 'B wrote into A';
  exception when insufficient_privilege then null; end;
  -- owner B has course.manage in B: can create there
  insert into public.courses (tenant_id, slug, title) select id, 'neet-chem', 'NEET Chemistry' from public.tenants;
  raise notice 'PASS RLS: cross-tenant read & write blocked; staff can write own tenant';
end $$;
reset role;

-- ================================================== act as FACULTY A
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', false);
do $$ begin
  if (select count(*) from public.questions) <> 3 then raise exception 'faculty should see question bank'; end if;
  if (select count(*) from public.test_attempts) <> 2 then raise exception 'faculty should see results'; end if;
  if exists (select 1 from public.orders) then null; end if;
  begin perform 1 from public.payment_gateway_accounts; exception when insufficient_privilege then null; end;
  if exists (select 1 from public.payment_gateway_accounts) then raise exception 'faculty sees gateway accounts'; end if;
  raise notice 'PASS RBAC: instructor sees question bank & results, not finance';
end $$;
reset role;

-- ================================================== limits, leaderboards, syllabus
do $$
declare ta uuid := (select id from public.tenants where slug = 'cloudcadre');
        n int;
begin
  insert into control.tenant_feature_overrides (tenant_id, feature_key, limit_value, reason) values (ta, 'limit.courses', 1, 'test');
  perform control.sync_tenant_local(ta);
  begin
    insert into public.courses (tenant_id, slug, title) values (ta, 'second', 'Second');
    raise exception 'course limit not enforced';
  exception when others then
    if sqlerrm <> 'plan_limit_reached:limit.courses' then raise; end if;
  end;
  raise notice 'PASS plan limit enforced in the database';

  n := private.refresh_leaderboard((select id from public.leaderboards where tenant_id = ta and key = 'weekly_xp'));
  if n <> 1 or (select score from public.leaderboard_entries where rank = 1 and tenant_id = ta) <> 115 then raise exception 'leaderboard: %', n; end if;
  raise notice 'PASS leaderboard snapshot';
end $$;

-- syllabus plan vs actual (needs batches → enable for A via override)
insert into control.tenant_feature_overrides (tenant_id, feature_key, enabled, reason)
values (:'ta', 'cohort.batches', true, 'test'), (:'ta', 'cohort.syllabus_tracking', true, 'test');
select control.sync_tenant_local(:'ta');
insert into public.batches (tenant_id, code, name, status, start_date) values (:'ta', 'SAA-NOV', 'SAA November', 'ongoing', current_date - 40) returning id as batch \gset
insert into public.syllabus_plans (tenant_id, batch_id, course_id, title) values (:'ta', :'batch', :'course_id', 'SAA plan') returning id as plan \gset
insert into public.syllabus_items (tenant_id, plan_id, title, phase_label, planned_start, planned_end, owner_member_id, position) values
  (:'ta', :'plan', 'IAM',      'Month 1', current_date - 40, current_date - 30, :'faculty', 1),
  (:'ta', :'plan', 'VPC',      'Month 1', current_date - 30, current_date - 20, :'faculty', 2),
  (:'ta', :'plan', 'Route 53', 'Month 2', current_date + 5,  current_date + 15, :'faculty', 3);
insert into public.syllabus_coverage (tenant_id, item_id, coverage_pct, covered_on)
select :'ta', id, 100, current_date - 31 from public.syllabus_items where title = 'IAM';
insert into public.syllabus_coverage (tenant_id, item_id, coverage_pct, covered_on)
select :'ta', id, 50, current_date - 21 from public.syllabus_items where title = 'VPC';
do $$
declare r record;
begin
  select * into r from public.v_instructor_syllabus_progress;
  -- expected by today: 2 of 3 items (66.7%); actual: 1.5 of 3 (50%); 1 delayed (VPC)
  if r.expected_pct <> 66.7 or r.actual_pct <> 50.0 or r.items_delayed <> 1 or r.items_completed <> 1 then
    raise exception 'syllabus progress wrong: %', row_to_json(r);
  end if;
  raise notice 'PASS faculty syllabus tracking: expected %, actual %, variance %', r.expected_pct, r.actual_pct, r.schedule_variance_pct;
end $$;

do $$ begin
  if (select count(*) from public.audit_logs where action = 'member_roles.insert') < 2 then raise exception 'audit trail missing'; end if;
  if (select count(*) from public.outbox_events where event_type in ('lesson.completed', 'course.completed', 'test.graded')) < 4 then raise exception 'outbox events missing'; end if;
  raise notice 'PASS audit log & transactional outbox populated';
end $$;

-- ================================================== learner self-signup (join_tenant)
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'newbie@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'blocked@example.com');
update public.tenant_settings set auth = '{"open_signup": false}' where tenant_id = :'tb';
select set_config('test.tb', :'tb', false);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', false);
do $$
declare v_a uuid := current_setting('test.ta')::uuid; m1 uuid; m2 uuid;
begin
  m1 := public.join_tenant(v_a, 'New Learner');
  m2 := public.join_tenant(v_a);
  if m1 is distinct from m2 then raise exception 'join_tenant not idempotent'; end if;
  if (select count(*) from public.tenant_members where user_id = '00000000-0000-0000-0000-0000000000c1') <> 1 then
    raise exception 'join_tenant created duplicates';
  end if;
  perform set_config('test.newbie', m1::text, false);
  raise notice 'PASS join_tenant: member created, idempotent';
end $$;
do $$
declare ok boolean := false; tb uuid := current_setting('test.tb')::uuid;
begin
  begin perform public.join_tenant(tb); exception when others then ok := sqlerrm = 'signup_closed'; end;
  if not ok then raise exception 'closed signup was not enforced'; end if;
  begin perform public.join_tenant(gen_random_uuid()); ok := false; exception when others then ok := sqlerrm = 'tenant_unavailable'; end;
  if not ok then raise exception 'unknown tenant was not rejected'; end if;
  raise notice 'PASS join_tenant: closed signup and unknown tenant rejected';
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id
                 where mr.member_id = current_setting('test.newbie')::uuid and r.key = 'student') then
    raise exception 'join_tenant did not grant the student role';
  end if;
  raise notice 'PASS join_tenant: student role granted';
end $$;

-- the WhatsApp number given at sign-up reaches the academy profile; anything malformed is ignored
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007a1', 'wa@example.com', '{"whatsapp":"+919876543210"}'),
  ('00000000-0000-0000-0000-0000000007a2', 'wa-bad@example.com', '{"whatsapp":"<script>"}');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000007a1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', false);
do $$ begin perform public.join_tenant(current_setting('test.ta')::uuid, 'Wa Learner'); end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000007a2', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a2","role":"authenticated"}', false);
do $$ begin perform public.join_tenant(current_setting('test.ta')::uuid); end $$;
reset role;
do $$ begin
  if (select phone from public.tenant_members where user_id = '00000000-0000-0000-0000-0000000007a1') is distinct from '+919876543210' then
    raise exception 'whatsapp number not copied to the member';
  end if;
  if (select phone from public.tenant_members where user_id = '00000000-0000-0000-0000-0000000007a2') is not null then
    raise exception 'malformed whatsapp number was stored';
  end if;
  raise notice 'PASS member contact: whatsapp number copied, malformed value ignored';
end $$;

-- ================================================== learner self-enrolment (enroll_in_course)
-- the limits test above capped courses at 1; lift it so this block can create its fixtures
delete from control.tenant_feature_overrides where tenant_id = current_setting('test.ta')::uuid and feature_key = 'limit.courses';
select control.sync_tenant_local(current_setting('test.ta')::uuid);
insert into public.courses (tenant_id, slug, title, status, published_at, settings, lesson_count, access_duration_days)
values (current_setting('test.ta')::uuid, 'open-course', 'Open Course', 'published', now(), '{"enrolment":"open"}', 3, 30),
       (current_setting('test.ta')::uuid, 'closed-course', 'Closed Course', 'published', now(), '{}', 1, null),
       (current_setting('test.ta')::uuid, 'draft-open', 'Draft Open', 'draft', null, '{"enrolment":"open"}', 1, null);
select set_config('test.open_course', (select id::text from public.courses where slug = 'open-course'), false);
select set_config('test.closed_course', (select id::text from public.courses where slug = 'closed-course'), false);
select set_config('test.draft_course', (select id::text from public.courses where slug = 'draft-open'), false);

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal1"}', false);
do $$
declare e1 uuid; e2 uuid; ok boolean;
begin
  e1 := public.enroll_in_course(current_setting('test.open_course')::uuid);
  e2 := public.enroll_in_course(current_setting('test.open_course')::uuid);
  if e1 is distinct from e2 then raise exception 'enroll_in_course not idempotent'; end if;
  if (select count(*) from public.enrollments) <> 1 then raise exception 'enrolment count'; end if;
  if (select lessons_total from public.enrollments) <> 3 or (select expires_at from public.enrollments) is null then
    raise exception 'enrolment did not copy lesson count and expiry';
  end if;
  raise notice 'PASS enroll_in_course: open course enrols, idempotent, expiry set';

  begin perform public.enroll_in_course(current_setting('test.closed_course')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'enrolment_closed'; end;
  if not ok then raise exception 'closed course accepted a self-enrolment'; end if;
  begin perform public.enroll_in_course(current_setting('test.draft_course')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'course_not_found'; end;
  if not ok then raise exception 'draft course accepted a self-enrolment'; end if;
  begin perform public.enroll_in_course(gen_random_uuid()); ok := false;
  exception when others then ok := sqlerrm = 'course_not_found'; end;
  if not ok then raise exception 'unknown course accepted'; end if;
  raise notice 'PASS enroll_in_course: closed, draft and unknown courses rejected';
end $$;
-- a learner of ANOTHER academy cannot enrol here
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","aal":"aal1"}', false);
do $$
declare ok boolean;
begin
  begin perform public.enroll_in_course(current_setting('test.open_course')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'not_a_member'; end;
  if not ok then raise exception 'non-member enrolled in another academy'; end if;
  raise notice 'PASS enroll_in_course: non-members rejected';
end $$;
reset role;
-- once a product sells the course, free self-enrolment closes (fresh learner: the first one is already in)
do $$
declare ta uuid := current_setting('test.ta')::uuid; v_p uuid; ok boolean;
begin
  insert into public.products (tenant_id, kind, slug, title, status) values (ta, 'course', 'open-course-paid', 'Open Course', 'published') returning id into v_p;
  insert into public.product_items (tenant_id, product_id, course_id) values (ta, v_p, current_setting('test.open_course')::uuid);
  delete from public.enrollments where course_id = current_setting('test.open_course')::uuid;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal1"}', false);
  begin perform public.enroll_in_course(current_setting('test.open_course')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'enrolment_closed'; end;
  if not ok then raise exception 'a sold course still allowed free enrolment'; end if;
  raise notice 'PASS enroll_in_course: closes once a product sells the course';
end $$;

-- ================================================== staff grant / revoke enrolment
do $$ begin perform set_config('test.newbie_member', (select id::text from public.tenant_members where user_id = '00000000-0000-0000-0000-0000000000c1'), false); end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}', false);
do $$
declare ok boolean;
begin
  begin perform public.grant_enrollment(current_setting('test.newbie_member')::uuid, current_setting('test.closed_course')::uuid); ok := false;
  exception when others then ok := sqlerrm = 'mfa_required'; end;
  if not ok then raise exception 'owner at aal1 granted access without MFA'; end if;
  raise notice 'PASS enrolment admin: aal1 session is refused even for the owner';
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal2"}', false);
do $$
declare e1 uuid; e2 uuid; ok boolean; m uuid := current_setting('test.newbie_member')::uuid; c uuid := current_setting('test.closed_course')::uuid;
begin
  e1 := public.grant_enrollment(m, c);
  e2 := public.grant_enrollment(m, c);
  if e1 is distinct from e2 then raise exception 'grant_enrollment not idempotent'; end if;
  if (select source from public.enrollments where id = e1) <> 'admin' then raise exception 'source'; end if;
  raise notice 'PASS grant_enrollment: owner grants, idempotent, source=admin';
  perform public.revoke_enrollment(e1, 'test');
  if (select status from public.enrollments where id = e1) <> 'cancelled' then raise exception 'not revoked'; end if;
  e2 := public.grant_enrollment(m, c);
  if e2 = e1 then raise exception 'regrant after revoke reused the cancelled row'; end if;
  raise notice 'PASS revoke_enrollment: cancels; a later grant creates a fresh enrolment';
end $$;
-- a learner cannot grant or revoke
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","aal":"aal2"}', false);
do $$
declare ok boolean; m uuid := current_setting('test.newbie_member')::uuid; c uuid := current_setting('test.open_course')::uuid;
begin
  begin perform public.grant_enrollment(m, c); ok := false; exception when others then ok := sqlerrm = 'not_allowed'; end;
  if not ok then raise exception 'learner granted an enrolment'; end if;
  begin perform public.revoke_enrollment((select id from public.enrollments limit 1)); ok := false; exception when others then ok := sqlerrm in ('not_allowed', 'enrollment_not_found'); end;
  if not ok then raise exception 'learner revoked an enrolment'; end if;
  raise notice 'PASS enrolment admin: learners cannot grant or revoke';
end $$;
-- the owner of another academy cannot touch this academy
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","aal":"aal2"}', false);
do $$
declare ok boolean; m uuid := current_setting('test.newbie_member')::uuid; c uuid := current_setting('test.open_course')::uuid;
begin
  begin perform public.grant_enrollment(m, c); ok := false; exception when others then ok := sqlerrm = 'not_allowed'; end;
  if not ok then raise exception 'cross-tenant grant allowed'; end if;
  raise notice 'PASS enrolment admin: cross-tenant grant rejected';
end $$;
reset role;

-- ================================================== checkout: gateway secrets, create_order, fulfil_order
do $$
declare ta uuid := current_setting('test.ta')::uuid; acc uuid; r record;
begin
  acc := public.save_gateway_account(ta, 'razorpay', 'test', 'rzp_test_key', 'the-secret', 'the-hook');
  select * into r from public.read_gateway_account(ta);
  if r.secret <> 'the-secret' or r.webhook_secret <> 'the-hook' or r.public_key <> 'rzp_test_key' then raise exception 'gateway secrets did not round-trip'; end if;
  if acc is distinct from public.save_gateway_account(ta, 'razorpay', 'live', 'rzp_live_key', '', '') then raise exception 'second save created another account'; end if;
  select * into r from public.read_gateway_account(ta);
  if r.secret <> 'the-secret' or r.mode <> 'live' or r.public_key <> 'rzp_live_key' then raise exception 'blank secret must keep the stored one'; end if;
  if exists (select 1 from public.payment_gateway_accounts where tenant_id = ta and (public_key like '%the-secret%')) then raise exception 'secret leaked into the table'; end if;
  raise notice 'PASS gateway account: secrets live in Vault, blank keeps, one account per gateway';
end $$;
do $$
declare ok boolean;
begin
  set local role authenticated;
  begin perform * from public.read_gateway_account(current_setting('test.ta')::uuid); ok := false; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'authenticated can read gateway secrets'; end if;
  begin perform public.save_gateway_account(current_setting('test.ta')::uuid, 'razorpay', 'test', 'k', 's', 'h'); ok := false; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'authenticated can save gateway secrets'; end if;
  reset role;
  raise notice 'PASS gateway account: unreachable for signed-in users';
end $$;

-- a 18%% inclusive price on the product that already sells open-course
do $$
declare ta uuid := current_setting('test.ta')::uuid; v_tax uuid; v_p uuid := (select id from public.products where slug = 'open-course-paid');
begin
  insert into public.tax_rates (tenant_id, name, rate_pct, hsn_sac_code, is_inclusive) values (ta, 'GST 18%%', 18, '999293', true) returning id into v_tax;
  insert into public.prices (tenant_id, product_id, amount_minor, tax_rate_id, is_default) values (ta, v_p, 118000, v_tax, true);
  perform set_config('test.product', v_p::text, false);
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal1"}', false);
do $$
declare o jsonb; o2 jsonb;
begin
  o := public.create_order(current_setting('test.product')::uuid);
  o2 := public.create_order(current_setting('test.product')::uuid);
  if (o ->> 'total_minor')::bigint <> 118000 then raise exception 'total %', o; end if;
  if o ->> 'order_id' <> o2 ->> 'order_id' or not (o2 ->> 'resumed')::boolean then raise exception 'second create_order should resume the first'; end if;
  if (select tax_minor from public.orders where id = (o ->> 'order_id')::uuid) <> 18000 or (select subtotal_minor from public.orders where id = (o ->> 'order_id')::uuid) <> 100000 then
    raise exception 'inclusive tax split wrong';
  end if;
  perform set_config('test.order', o ->> 'order_id', false);
  raise notice 'PASS create_order: snapshot total, inclusive GST split, resumes an open order';
end $$;
do $$
declare ok boolean;
begin
  begin perform public.fulfil_order(current_setting('test.order')::uuid, 'razorpay', 'o1', 'p1', 118000); ok := false; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'a learner can mark an order paid'; end if;
  raise notice 'PASS fulfil_order: a learner cannot call it';
end $$;
-- not a member of that academy
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","aal":"aal1"}', false);
do $$
declare ok boolean;
begin
  begin perform public.create_order(current_setting('test.product')::uuid); ok := false; exception when others then ok := sqlerrm = 'not_a_member'; end;
  if not ok then raise exception 'non-member created an order'; end if;
  raise notice 'PASS create_order: non-members rejected';
end $$;
reset role;

do $$
declare ok boolean; r jsonb; o uuid := current_setting('test.order')::uuid; ta uuid := current_setting('test.ta')::uuid;
begin
  begin perform public.fulfil_order(o, 'razorpay', 'order_X', 'pay_1', 100); ok := false; exception when others then ok := sqlerrm = 'amount_mismatch'; end;
  if not ok then raise exception 'underpayment fulfilled the order'; end if;
  if (select status from public.orders where id = o) <> 'awaiting_payment' then raise exception 'order changed on a rejected payment'; end if;

  r := public.fulfil_order(o, 'razorpay', 'order_X', 'pay_1', 118000, 'upi', '{"id":"pay_1"}');
  if r ->> 'status' <> 'paid' or (r ->> 'enrollments')::int <> 1 then raise exception 'fulfil: %', r; end if;
  r := public.fulfil_order(o, 'razorpay', 'order_X', 'pay_1', 118000, 'upi');
  if not (r ->> 'already')::boolean then raise exception 'second fulfil should be a no-op'; end if;
  if (select count(*) from public.payments where order_id = o) <> 1 then raise exception 'duplicate payment rows'; end if;
  if (select count(*) from public.enrollments e join public.order_items oi on oi.id = e.order_item_id where oi.order_id = o and e.source = 'purchase') <> 1 then raise exception 'enrolment missing or duplicated'; end if;
  if (select count(*) from public.invoices where order_id = o and kind = 'receipt') <> 1 then raise exception 'receipt missing'; end if;
  if (select sales_count from public.products where id = current_setting('test.product')::uuid) <> 1 then raise exception 'sales_count'; end if;
  raise notice 'PASS fulfil_order: amount checked, pays once, enrols, receipt, idempotent';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
declare ok boolean;
begin
  begin perform public.create_order(current_setting('test.product')::uuid); ok := false; exception when others then ok := sqlerrm = 'already_enrolled'; end;
  if not ok then raise exception 'bought the same course twice'; end if;
  if (select count(*) from public.orders) <> 1 or (select count(*) from public.payments) <> 1 then raise exception 'learner sees wrong orders/payments'; end if;
  raise notice 'PASS create_order: refuses a second purchase; learner sees only own order and payment';
end $$;
reset role;


-- ================================================== coupons, free orders, refunds (migration 20)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'coupon-1@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'coupon-2@example.com');
do $$
declare ta uuid := current_setting('test.ta')::uuid; c uuid; p uuid; tax uuid;
begin
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values
    (ta, '00000000-0000-0000-0000-0000000000d1', 'Coupon One', 'coupon-1@example.com'),
    (ta, '00000000-0000-0000-0000-0000000000d2', 'Coupon Two', 'coupon-2@example.com');
  insert into public.courses (tenant_id, slug, title, kind, status, published_at) values (ta, 'coupon-course', 'Coupon course', 'course', 'published', now()) returning id into c;
  insert into public.products (tenant_id, kind, slug, title, status) values (ta, 'course', 'coupon-course-paid', 'Coupon course', 'published') returning id into p;
  insert into public.product_items (tenant_id, product_id, course_id) values (ta, p, c);
  select id into tax from public.tax_rates where tenant_id = ta and name = 'GST 18%%' limit 1;
  insert into public.prices (tenant_id, product_id, amount_minor, tax_rate_id, is_default) values (ta, p, 118000, tax, true);
  insert into public.coupons (tenant_id, code, discount_type, discount_value) values (ta, 'PCT10', 'percent', 10);
  insert into public.coupons (tenant_id, code, discount_type, discount_value) values (ta, 'FLAT200', 'fixed', 200);
  insert into public.coupons (tenant_id, code, discount_type, discount_value) values (ta, 'FREE', 'percent', 100);
  insert into public.coupons (tenant_id, code, discount_type, discount_value, ends_at) values (ta, 'OLD', 'percent', 10, now() - interval '1 day');
  insert into public.coupons (tenant_id, code, discount_type, discount_value, max_redemptions) values (ta, 'ONCE', 'percent', 50, 1);
  insert into public.coupons (tenant_id, code, discount_type, discount_value, min_order_minor) values (ta, 'BIGONLY', 'percent', 10, 500000);
  perform set_config('test.coupon_product', p::text, false);
  perform set_config('test.coupon_course', c::text, false);
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
declare o jsonb; oid uuid; r jsonb; ok boolean;
begin
  o := public.create_order(current_setting('test.coupon_product')::uuid);
  oid := (o ->> 'order_id')::uuid;
  perform set_config('test.c_order1', oid::text, false);

  r := public.apply_coupon(oid, 'pct10');
  if (r ->> 'total_minor')::bigint <> 106200 or (r ->> 'discount_minor')::bigint <> 11800 or (r ->> 'tax_minor')::bigint <> 16200 then raise exception '10%% coupon: %', r; end if;
  if (select subtotal_minor from public.orders where id = oid) <> 90000 then raise exception 'subtotal after coupon'; end if;
  r := public.apply_coupon(oid, 'FLAT200');
  if (r ->> 'total_minor')::bigint <> 98000 then raise exception 'fixed coupon replaces the previous one: %', r; end if;
  r := public.remove_coupon(oid);
  if (r ->> 'total_minor')::bigint <> 118000 or (select coupon_id from public.orders where id = oid) is not null then raise exception 'remove coupon: %', r; end if;
  raise notice 'PASS coupons: percent and fixed re-price the order with the GST split, one at a time, removable';

  begin perform public.apply_coupon(oid, 'OLD'); ok := false; exception when others then ok := sqlerrm = 'coupon_expired'; end;
  if not ok then raise exception 'expired coupon accepted'; end if;
  begin perform public.apply_coupon(oid, 'NOPE'); ok := false; exception when others then ok := sqlerrm = 'coupon_invalid'; end;
  if not ok then raise exception 'unknown coupon accepted'; end if;
  begin perform public.apply_coupon(oid, 'BIGONLY'); ok := false; exception when others then ok := sqlerrm = 'coupon_min_order'; end;
  if not ok then raise exception 'minimum order ignored'; end if;
  raise notice 'PASS coupons: expired, unknown and below-minimum are refused';
end $$;
-- someone else's order
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","aal":"aal1"}', false);
do $$
declare ok boolean;
begin
  begin perform public.apply_coupon(current_setting('test.c_order1')::uuid, 'PCT10'); ok := false; exception when others then ok := sqlerrm = 'order_not_found'; end;
  if not ok then raise exception 'applied a coupon to another learner''s order'; end if;
  raise notice 'PASS coupons: cannot touch another learner''s order';
end $$;
reset role;

-- a stale gateway order must not survive a price change
do $$
declare oid uuid := current_setting('test.c_order1')::uuid; ta uuid := current_setting('test.ta')::uuid;
begin
  insert into public.payments (tenant_id, order_id, gateway, gateway_order_id, amount_minor, status) values (ta, oid, 'razorpay', 'order_stale', 118000, 'created');
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal1"}', true);
  perform public.apply_coupon(oid, 'PCT10');
  reset role;
  if (select status from public.payments where gateway_order_id = 'order_stale') <> 'failed' then raise exception 'old gateway order still open'; end if;
  raise notice 'PASS coupons: the gateway order made for the old total is closed';
end $$;

-- a paid coupon order, then the single-use coupon is gone
do $$
declare oid uuid := current_setting('test.c_order1')::uuid; r jsonb; ok boolean; o2 jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal1"}', true);
  perform public.apply_coupon(oid, 'ONCE');
  reset role;
  r := public.fulfil_order(oid, 'razorpay', 'order_c1', 'pay_c1', 59000, 'upi');
  if r ->> 'status' <> 'paid' then raise exception 'discounted order not paid: %', r; end if;
  if (select redeemed_count from public.coupons where code = 'ONCE') <> 1 or (select count(*) from public.coupon_redemptions) <> 1 then raise exception 'redemption not recorded'; end if;
  if (select totals ->> 'coupon' from public.invoices where order_id = oid and kind = 'receipt') <> 'ONCE' then raise exception 'receipt does not name the coupon'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","aal":"aal1"}', true);
  o2 := public.create_order(current_setting('test.coupon_product')::uuid);
  begin perform public.apply_coupon((o2 ->> 'order_id')::uuid, 'ONCE'); ok := false; exception when others then ok := sqlerrm = 'coupon_used_up'; end;
  if not ok then raise exception 'single-use coupon used twice'; end if;
  perform set_config('test.c_order2', o2 ->> 'order_id', true);
  perform public.apply_coupon((o2 ->> 'order_id')::uuid, 'FREE');
  reset role;
  raise notice 'PASS coupons: paid with a discount, redemption and receipt record it, single-use coupon is used up';
end $$;

-- a 100%% coupon: no gateway payment, still enrols
do $$
declare oid uuid; r jsonb; ta uuid := current_setting('test.ta')::uuid; v_member uuid;
begin
  select id into oid from public.orders where member_id = (select id from public.tenant_members where user_id = '00000000-0000-0000-0000-0000000000d2') and status = 'awaiting_payment';
  if (select total_minor from public.orders where id = oid) <> 0 or (select tax_minor from public.orders where id = oid) <> 0 then raise exception 'free order total'; end if;
  begin perform public.fulfil_order(oid, 'free', null, null, 100); raise exception 'wrong amount accepted'; exception when others then if sqlerrm <> 'amount_mismatch' then raise; end if; end;
  r := public.fulfil_order(oid, 'free', null, null, 0);
  if r ->> 'status' <> 'paid' then raise exception 'free order: %', r; end if;
  if exists (select 1 from public.payments where order_id = oid) then raise exception 'free order made a payment row'; end if;
  select id into v_member from public.tenant_members where user_id = '00000000-0000-0000-0000-0000000000d2';
  if (select source from public.enrollments where member_id = v_member and course_id = current_setting('test.coupon_course')::uuid) <> 'coupon' then raise exception 'free order did not enrol'; end if;
  raise notice 'PASS free order: 100%% coupon enrols with no payment row';
end $$;

-- refunds
do $$
declare
  o uuid := current_setting('test.order')::uuid; ok boolean; b jsonb; v_enr uuid;
begin
  -- learners cannot call the refund functions
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","aal":"aal2"}', true);
  begin perform public.begin_refund(o, 1000, 'x', true, null); ok := false; exception when insufficient_privilege then ok := true; end;
  reset role;
  if not ok then raise exception 'authenticated can start a refund'; end if;

  begin perform public.begin_refund(o, 200000, 'too much', true, null); ok := false; exception when others then ok := sqlerrm = 'refund_amount_invalid'; end;
  if not ok then raise exception 'refund above the payment accepted'; end if;

  b := public.begin_refund(o, 10000, 'try', false, null);
  perform public.finish_refund((b ->> 'refund_id')::uuid, false);
  if (select status from public.refunds where id = (b ->> 'refund_id')::uuid) <> 'failed' or (select status from public.orders where id = o) <> 'paid' then raise exception 'failed refund changed the order'; end if;

  b := public.begin_refund(o, 50000, 'partial', false, null);
  begin perform public.begin_refund(o, 68001, 'over', false, null); ok := false; exception when others then ok := sqlerrm = 'refund_amount_invalid'; end;
  if not ok then raise exception 'pending refund not counted'; end if;
  perform public.finish_refund((b ->> 'refund_id')::uuid, true, 'rfnd_1');
  if (select status from public.orders where id = o) <> 'partially_refunded' then raise exception 'order not partially refunded'; end if;
  select id into v_enr from public.enrollments where order_item_id in (select id from public.order_items where order_id = o);
  if (select status from public.enrollments where id = v_enr) <> 'active' then raise exception 'partial refund revoked access'; end if;
  perform public.finish_refund((b ->> 'refund_id')::uuid, true, 'rfnd_1');   -- idempotent

  b := public.begin_refund(o, 68000, 'rest', true, null);
  perform public.finish_refund((b ->> 'refund_id')::uuid, true, 'rfnd_2');
  if (select status from public.orders where id = o) <> 'refunded' or (select status from public.payments where order_id = o) <> 'refunded' then raise exception 'order not refunded'; end if;
  if (select status from public.enrollments where id = v_enr) <> 'refunded' then raise exception 'access not revoked'; end if;
  if (select count(*) from public.invoices where order_id = o and kind = 'credit_note') <> 2 then raise exception 'credit notes'; end if;
  begin perform public.begin_refund(o, 1, 'again', true, null); ok := false; exception when others then ok := sqlerrm = 'order_not_refundable'; end;
  if not ok then raise exception 'refunded order refunded again'; end if;
  raise notice 'PASS refunds: pending/failed/processed, partial then full, access revoked on request, credit notes';
end $$;


-- ================================================== sequential courses and drip unlock (migration 21)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'seq-1@example.com');
do $$
declare ta uuid := current_setting('test.ta')::uuid; m uuid; c uuid; s uuid; l1 uuid; l2 uuid; l3 uuid; l4 uuid; e uuid;
begin
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values (ta, '00000000-0000-0000-0000-0000000000e1', 'Seq One', 'seq-1@example.com') returning id into m;
  insert into public.courses (tenant_id, slug, title, kind, status, published_at, settings) values (ta, 'seq-course', 'Sequential', 'course', 'published', now(), '{"sequential":true}') returning id into c;
  insert into public.course_sections (tenant_id, course_id, title, position, is_published) values (ta, c, 'One', 1, true) returning id into s;
  insert into public.lessons (tenant_id, course_id, section_id, type, title, position, is_published, published_at) values (ta, c, s, 'article', 'L1', 1, true, now()) returning id into l1;
  insert into public.lessons (tenant_id, course_id, section_id, type, title, position, is_published, published_at) values (ta, c, s, 'article', 'L2', 2, true, now()) returning id into l2;
  insert into public.lessons (tenant_id, course_id, section_id, type, title, position, is_published, published_at) values (ta, c, s, 'article', 'L3', 3, true, now()) returning id into l3;
  insert into public.lessons (tenant_id, course_id, section_id, type, title, position, is_published, published_at, unlock_rule, is_mandatory)
    values (ta, c, s, 'article', 'Drip', 4, true, now(), '{"type":"days_after_enrolment","days":7}', false) returning id into l4;
  insert into public.enrollments (tenant_id, member_id, course_id, source) values (ta, m, c, 'admin') returning id into e;
  perform set_config('test.seq_course', c::text, false);
  perform set_config('test.seq_l', l1::text || ',' || l2::text || ',' || l3::text || ',' || l4::text, false);
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
declare l uuid[] := string_to_array(current_setting('test.seq_l'), ',')::uuid[]; c uuid := current_setting('test.seq_course')::uuid; n int; r record; ok boolean;
begin
  select count(*) into n from public.my_lesson_locks(c);
  if n <> 3 then raise exception 'expected L2, L3 and the drip lesson locked, got %', n; end if;
  if (select reason from public.my_lesson_locks(c) where lesson_id = l[2]) <> 'sequential' or (select blocking_lesson_id from public.my_lesson_locks(c) where lesson_id = l[3]) <> l[1] then raise exception 'wrong blocker'; end if;
  select * into r from public.my_lesson_locks(c) where lesson_id = l[4];
  if r.reason <> 'drip' or r.unlocks_at < now() + interval '6 days' then raise exception 'drip lock wrong: %', r; end if;

  begin perform public.record_lesson_progress(l[3], null, 1, null, false); ok := false; exception when others then ok := sqlerrm = 'lesson_locked'; end;
  if not ok then raise exception 'a locked lesson was progressed'; end if;

  perform public.record_lesson_progress(l[1], null, 1, null, false);   -- article, auto: complete on view
  if exists (select 1 from public.my_lesson_locks(c) where lesson_id = l[2]) then raise exception 'L2 should open after L1'; end if;
  if not exists (select 1 from public.my_lesson_locks(c) where lesson_id = l[3] and blocking_lesson_id = l[2]) then raise exception 'L3 should now wait for L2'; end if;
  raise notice 'PASS sequential course: later lessons wait for the earlier ones, progress is refused while locked';
  raise notice 'PASS drip: a lesson unlocks N days after enrolment';
end $$;
-- another learner has no locks in a course they are not in
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal1"}', false);
do $$
begin
  if exists (select 1 from public.my_lesson_locks(current_setting('test.seq_course')::uuid)) then raise exception 'lock state leaked to someone not enrolled'; end if;
  raise notice 'PASS locks: only visible to the enrolled learner';
end $$;
reset role;


-- ================================================== quizzes: authoring, taking, result (migration 22)
do $$
declare ta uuid := current_setting('test.ta')::uuid; m uuid; c uuid; sec uuid; t uuid; l uuid;
begin
  insert into public.courses (tenant_id, slug, title, kind, status, published_at) values (ta, 'quiz-course', 'Quiz course', 'course', 'published', now()) returning id into c;
  insert into public.course_sections (tenant_id, course_id, title, position, is_published) values (ta, c, 'S', 1, true) returning id into sec;
  insert into public.tests (tenant_id, course_id, kind, title, status, settings, max_attempts) values (ta, c, 'quiz', 'Cloud quiz', 'published', '{"pass_pct":50}', 2) returning id into t;
  insert into public.lessons (tenant_id, course_id, section_id, type, title, position, is_published, published_at, test_id, completion_rule)
    values (ta, c, sec, 'quiz', 'Quiz lesson', 1, true, now(), t, '{"type":"pass_test"}') returning id into l;
  select id into m from public.tenant_members where user_id = '00000000-0000-0000-0000-0000000000e1';
  insert into public.enrollments (tenant_id, member_id, course_id, source) values (ta, m, c, 'admin');
  perform set_config('test.quiz', t::text, false);
  perform set_config('test.quiz_lesson', l::text, false);
end $$;

-- owner authors three questions
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
declare t uuid := current_setting('test.quiz')::uuid; q1 uuid; q2 uuid; q3 uuid; ok boolean;
begin
  q1 := public.save_quiz_question(t, null, 'mcq_single', 'Which is object storage?', '[{"id":"a","text":"S3"},{"id":"b","text":"EBS"},{"id":"c","text":"VPC"}]', array['a'], 2, 'S3 stores objects.');
  q2 := public.save_quiz_question(t, null, 'mcq_multi', 'Pick the compute services', '[{"id":"a","text":"EC2"},{"id":"b","text":"S3"},{"id":"c","text":"Lambda"}]', array['a','c'], 1, null);
  q3 := public.save_quiz_question(t, null, 'true_false', 'Regions contain zones', null, array['true'], 1, null);
  if (select total_marks from public.tests where id = t) <> 4 or (select pass_marks from public.tests where id = t) <> 2 then raise exception 'totals: % %', (select total_marks from public.tests where id = t), (select pass_marks from public.tests where id = t); end if;
  perform public.save_quiz_question(t, q1, 'mcq_single', 'Which is object storage?', '[{"id":"a","text":"S3"},{"id":"b","text":"EBS"}]', array['a'], 2, 'S3 stores objects.');
  begin perform public.save_quiz_question(t, null, 'mcq_single', 'Bad', '[{"id":"a","text":"x"},{"id":"b","text":"y"}]', array['a','b'], 1, null); ok := false; exception when others then ok := sqlerrm = 'answer_invalid'; end;
  if not ok then raise exception 'two correct answers accepted for a single-answer question'; end if;
  begin perform public.save_quiz_question(t, null, 'mcq_single', 'Bad', '[{"id":"a","text":"x"},{"id":"z","text":"y"}]', array['a'], 1, null); ok := false; exception when others then ok := sqlerrm = 'options_invalid'; end;
  if not ok then raise exception 'bad option id accepted'; end if;
  perform set_config('test.quiz_q', q1::text || ',' || q2::text || ',' || q3::text, false);
  raise notice 'PASS quiz authoring: three question types saved with keys, totals and pass mark maintained, bad input refused';
end $$;
-- a learner cannot author
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","aal":"aal1"}', false);
do $$
declare ok boolean;
begin
  begin perform public.save_quiz_question(current_setting('test.quiz')::uuid, null, 'true_false', 'x', null, array['true'], 1, null); ok := false; exception when others then ok := sqlerrm = 'not_allowed'; end;
  if not ok then raise exception 'learner authored a question'; end if;
  if exists (select 1 from public.question_keys) then raise exception 'learner can read answer keys'; end if;
  raise notice 'PASS quiz authoring: learners refused, keys unreadable';
end $$;

-- the learner takes it
do $$
declare t uuid := current_setting('test.quiz')::uuid; q uuid[] := string_to_array(current_setting('test.quiz_q'), ',')::uuid[]; o jsonb; att uuid; paper jsonb; r jsonb;
begin
  o := public.get_test_overview(t);
  if (o ->> 'question_count')::int <> 3 or (o ->> 'pass_pct')::numeric <> 50 or o -> 'open_attempt_id' <> 'null'::jsonb then raise exception 'overview: %', o; end if;
  att := public.start_test_attempt(t);
  paper := public.get_attempt_paper(att);
  if jsonb_array_length(paper -> 'questions') <> 3 or paper::text like '%correct%' then raise exception 'paper wrong or leaks the key'; end if;
  begin perform public.get_attempt_result(att); raise exception 'open attempt result readable'; exception when others then if sqlerrm <> 'attempt_open' then raise; end if; end;
  perform public.save_attempt_answer(att, q[1], '{"selected":"a"}');
  perform public.save_attempt_answer(att, q[2], '{"selected":["a"]}');
  perform public.save_attempt_answer(att, q[3], '{"selected":"true"}');
  r := public.submit_test_attempt(att);
  if (r ->> 'score')::numeric <> 3 or (r ->> 'percentage')::numeric <> 75 or not (r ->> 'is_passed')::boolean then raise exception 'submit: %', r; end if;
  r := public.get_attempt_result(att);
  if (r ->> 'review_shown')::boolean is not true or jsonb_array_length(r -> 'review') <> 3 then raise exception 'review: %', r; end if;
  if (r -> 'review' -> 0 -> 'correct') <> '["a"]'::jsonb or (r -> 'review' -> 1 ->> 'is_correct')::boolean is not false then raise exception 'review content: %', r -> 'review'; end if;
  if (select status from public.lesson_progress where lesson_id = current_setting('test.quiz_lesson')::uuid) <> 'completed' then raise exception 'passing did not complete the quiz lesson'; end if;
  o := public.get_test_overview(t);
  if jsonb_array_length(o -> 'attempts') <> 1 or (o -> 'attempts' -> 0 ->> 'score')::numeric <> 3 then raise exception 'overview attempts: %', o; end if;
  perform set_config('test.quiz_attempt', att::text, false);
  raise notice 'PASS quiz taking: paper without keys, autosave, grading, result review, lesson completes on pass';
end $$;
-- someone else cannot read that result
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","aal":"aal1"}', false);
do $$
declare ok boolean;
begin
  begin perform public.get_attempt_result(current_setting('test.quiz_attempt')::uuid); ok := false; exception when others then ok := sqlerrm = 'attempt_not_found'; end;
  if not ok then raise exception 'another learner read a result'; end if;
  begin perform public.get_test_overview(current_setting('test.quiz')::uuid); ok := false; exception when others then ok := sqlerrm = 'not_enrolled'; end;
  if not ok then raise exception 'overview for a non-enrolled learner'; end if;
  raise notice 'PASS quiz results: private to the learner, overview needs enrolment';
end $$;
reset role;
-- deleting a question
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
declare q uuid[] := string_to_array(current_setting('test.quiz_q'), ',')::uuid[];
begin
  perform public.delete_quiz_question(current_setting('test.quiz')::uuid, q[3]);
  if (select total_marks from public.tests where id = current_setting('test.quiz')::uuid) <> 3 then raise exception 'total after delete'; end if;
  raise notice 'PASS quiz authoring: deleting a question updates the total';
end $$;
reset role;


-- ================================================== a completed course stays readable; a refunded one does not (migration 23)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
begin
  if (select status from public.enrollments where course_id = (select course_id from public.lessons where id = current_setting('test.quiz_lesson')::uuid)) <> 'completed' then raise exception 'precondition: the quiz course should be completed'; end if;
  if not exists (select 1 from public.lessons where id = current_setting('test.quiz_lesson')::uuid) then raise exception 'a completed course is no longer readable'; end if;
  raise notice 'PASS completed enrolment: lessons stay readable for review';
end $$;
reset role;
update public.enrollments set status = 'refunded' where course_id = (select course_id from public.lessons where id = current_setting('test.quiz_lesson')::uuid);
set role authenticated;
do $$
begin
  if exists (select 1 from public.lessons where id = current_setting('test.quiz_lesson')::uuid) then raise exception 'a refunded enrolment still reads lessons'; end if;
  raise notice 'PASS refunded enrolment: lessons are closed again';
end $$;
reset role;


-- ================================================== badges, certificates, leaderboard, email outbox (migration 24)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'badges-1@example.com');
do $$
declare ta uuid := current_setting('test.ta')::uuid; m uuid; c uuid := (select course_id from public.lessons where id = current_setting('test.quiz_lesson')::uuid);
begin
  insert into public.badges (tenant_id, key, name, tier, criteria, xp_reward) values
    (ta, 't_first_lesson', 'First lesson', 'bronze', '{"event":"lesson.completed","count":1}', 10),
    (ta, 't_passer', 'Passer', 'silver', '{"event":"test.graded","count":1,"where":{"percentage_gte":50}}', 20),
    (ta, 't_finisher', 'Finisher', 'gold', '{"event":"course.completed","count":1}', 30),
    (ta, 't_streak', 'Day one', 'bronze', '{"metric":"current_streak","gte":1}', 5),
    (ta, 't_never', 'Never', 'platinum', '{"event":"lesson.completed","count":999}', 100);
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values (ta, '00000000-0000-0000-0000-0000000000f1', 'Badge One', 'badges-1@example.com') returning id into m;
  insert into public.enrollments (tenant_id, member_id, course_id, source) values (ta, m, c, 'admin');
  perform set_config('test.badge_member', m::text, false);
  perform set_config('test.badge_course', c::text, false);
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
declare t uuid := current_setting('test.quiz')::uuid; q uuid[] := string_to_array(current_setting('test.quiz_q'), ',')::uuid[]; att uuid;
begin
  att := public.start_test_attempt(t);
  perform public.save_attempt_answer(att, q[1], '{"selected":"a"}');
  perform public.save_attempt_answer(att, q[2], '{"selected":["a","c"]}');
  perform public.submit_test_attempt(att);
end $$;
reset role;
do $$
declare m uuid := current_setting('test.badge_member')::uuid; ta uuid := current_setting('test.ta')::uuid; cert public.certificates; e public.enrollments;
begin
  if (select array_agg(b.key order by b.key) from public.member_badges mb join public.badges b on b.id = mb.badge_id where mb.member_id = m and b.key like 't\_%') <> array['t_finisher','t_first_lesson','t_passer','t_streak'] then
    raise exception 'badges awarded: %', (select array_agg(b.key) from public.member_badges mb join public.badges b on b.id = mb.badge_id where mb.member_id = m);
  end if;
  if (select badges_count from public.member_stats where member_id = m) < 4 then raise exception 'badges_count'; end if;
  if (select coalesce(sum(points), 0) from public.xp_ledger where member_id = m and reason = 'badge.awarded' and source_id in (select id from public.badges where key like 't\_%')) <> 65 then raise exception 'badge xp'; end if;
  raise notice 'PASS badges: awarded from criteria (event counts, score threshold, course, streak); unmet ones are not; XP rewards land';

  select * into e from public.enrollments where member_id = m and course_id = current_setting('test.badge_course')::uuid;
  select * into cert from public.certificates where enrollment_id = e.id;
  if e.status <> 'completed' or cert.id is null or e.certificate_id <> cert.id then raise exception 'completion did not issue a certificate'; end if;
  if cert.serial_no !~ '^CERT-[0-9]{4}-[0-9]{6}$' or length(cert.verification_code) <> 12 or cert.recipient_name <> 'Badge One' then raise exception 'certificate fields: %', cert; end if;
  if (select count(*) from public.certificates where member_id = m) <> 1 then raise exception 'duplicate certificates'; end if;
  if not exists (select 1 from public.outbox_events where event_type = 'certificate.issued' and aggregate_id = cert.id) then raise exception 'certificate event missing'; end if;
  perform set_config('test.cert', cert.id::text, false);
  raise notice 'PASS certificates: issued once on completion with serial and verification code';
end $$;

-- the learner can read their own, not revoke; staff revoke
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
declare ok boolean; r jsonb;
begin
  if (select count(*) from public.certificates) <> 1 then raise exception 'learner sees % certificates', (select count(*) from public.certificates); end if;
  begin perform public.revoke_certificate(current_setting('test.cert')::uuid, 'x'); ok := false; exception when others then ok := sqlerrm = 'not_allowed'; end;
  if not ok then raise exception 'learner revoked a certificate'; end if;

  r := public.get_leaderboard('all_time_xp');
  if r is null or (r -> 'me' ->> 'rank') is null or jsonb_array_length(r -> 'entries') < 1 then raise exception 'leaderboard: %', r; end if;
  if (r -> 'entries' -> 0 ->> 'rank')::int <> 1 then raise exception 'leaderboard order'; end if;
  if public.get_leaderboard('no_such_board') is not null then raise exception 'unknown board returned something'; end if;
  raise notice 'PASS leaderboard: refreshed on read, ranked, caller placed; certificates private to the learner';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","aal":"aal1"}', false);
set role authenticated;
do $$
begin
  perform public.revoke_certificate(current_setting('test.cert')::uuid, 'test');
  if (select revoked_at from public.certificates where id = current_setting('test.cert')::uuid) is null then raise exception 'staff revoke failed'; end if;
  raise notice 'PASS certificates: staff can revoke';
end $$;
reset role;

-- the email worker's queue: claimed once, retried after an error, finished
do $$
declare n int; id1 uuid; r public.outbox_events;
begin
  select count(*) into n from public.claim_outbox_events(1000);
  if n < 1 then raise exception 'nothing to claim'; end if;
  if (select count(*) from public.claim_outbox_events(1000)) <> 0 then raise exception 'events claimed twice'; end if;
  select id into id1 from public.outbox_events where event_type = 'certificate.issued' limit 1;
  perform public.finish_outbox_event(id1, 'smtp down');
  select * into r from public.outbox_events where id = id1;
  if r.published_at is not null or r.last_error <> 'smtp down' or r.available_at <= now() then raise exception 'failure should schedule a retry: %', r; end if;
  perform public.finish_outbox_event(id1, null);
  if (select published_at from public.outbox_events where id = id1) is null then raise exception 'finish did not publish'; end if;
  raise notice 'PASS outbox: claimed once, retried on error, finished';
end $$;
set role authenticated;
do $$
declare ok boolean;
begin
  begin perform public.claim_outbox_events(1); ok := false; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'authenticated can claim outbox events'; end if;
  raise notice 'PASS outbox: unreachable for signed-in users';
end $$;
reset role;

\echo 'ALL SMOKE TESTS PASSED'

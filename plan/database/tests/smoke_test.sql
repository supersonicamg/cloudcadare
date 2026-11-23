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

\echo 'ALL SMOKE TESTS PASSED'

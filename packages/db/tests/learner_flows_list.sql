-- Slice 3 (plan/16 §4.3, §11): the learner list. Run with `node scripts/db-test.mjs packages/db/tests/learner_flows_list.sql`.
-- Everything happens in a transaction that is rolled back.
do $$
declare
  t      uuid := (select id from public.tenants where slug = 'cloudcadre');
  staff  uuid;
  course uuid;
  u1 uuid := gen_random_uuid();  m1 uuid;   -- the listed learner
  u2 uuid := gen_random_uuid();  m2 uuid;   -- someone with a different email
  u3 uuid := gen_random_uuid();  m3 uuid;   -- listed but email never confirmed
  r jsonb;
  n int;
  wid uuid;
begin
  select m.user_id into staff from public.member_roles mr
    join public.role_permissions rp on rp.role_id = mr.role_id and rp.permission_key = 'enrollment.manage'
    join public.tenant_members m on m.id = mr.member_id
   where mr.tenant_id = t and mr.scope_type = 'tenant' and m.user_id is not null limit 1;
  if staff is null then raise exception 'no staff member with enrollment.manage in the dev academy'; end if;
  insert into public.courses (tenant_id, slug, title) values (t, 'sql-list-course', 'SQL list course') returning id into course;

  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u1, 'Listed.Learner@Example.com', 'authenticated', 'authenticated', '{}'),
    (u2, 'someone.else@example.com', 'authenticated', 'authenticated', '{}'),
    (u3, 'unconfirmed@example.com', 'authenticated', 'authenticated', '{}');
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values (t, u1, 'Listed', 'Listed.Learner@Example.com') returning id into m1;
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values (t, u2, 'Other', 'someone.else@example.com') returning id into m2;
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values (t, u3, 'Unconfirmed', 'unconfirmed@example.com') returning id into m3;

  -- staff without the two-step check (aal1) cannot add
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin
    perform public.add_to_learner_list(t, course, null, null, '[{"email":"x@example.com"}]'::jsonb);
    raise exception 'aal1 staff must not add to the list';
  exception when insufficient_privilege then raise notice 'ok: add needs the two-step check'; end;

  -- a learner cannot add
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin
    perform public.add_to_learner_list(t, course, null, null, '[{"email":"x@example.com"}]'::jsonb);
    raise exception 'a learner must not add to the list';
  exception when insufficient_privilege then raise notice 'ok: learners cannot add'; end;

  -- staff adds: typed with capitals and spaces, one wrong, one repeated
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  r := public.add_to_learner_list(t, course, null, now() + interval '1 year',
        '[{"email":"  LISTED.learner@example.com ","name":"Listed"},{"email":"unconfirmed@example.com"},{"email":"rohit@gmailcom"},{"email":"listed.learner@example.com"}]'::jsonb);
  if jsonb_array_length(r -> 'added') <> 2 or jsonb_array_length(r -> 'invalid') <> 1 then raise exception 'add result: %', r; end if;
  r := public.add_to_learner_list(t, course, null, now() + interval '1 year', '[{"email":"listed.learner@example.com"}]'::jsonb);
  if jsonb_array_length(r -> 'existing') <> 1 then raise exception 'adding twice must say already on the list: %', r; end if;
  raise notice 'ok: add, normalise, flag wrong, report repeats';

  -- an email nobody has confirmed is never matched, even if it is on the list
  if private.claim_whitelist(m3) <> 'not_listed' then raise exception 'unconfirmed email must not claim'; end if;
  update public.tenant_members set email_verified_at = now() where id in (m1, m2, m3);
  raise notice 'ok: unconfirmed email never claims';

  -- a different email never claims
  if private.claim_whitelist(m2) <> 'not_listed' then raise exception 'a different email must not claim'; end if;

  -- the listed learner claims once, and a second call does nothing
  if private.claim_whitelist(m1) <> 'claimed' then raise exception 'listed learner must claim'; end if;
  select count(*) into n from public.enrollments where member_id = m1 and course_id = course and source = 'import' and status = 'active';
  if n <> 1 then raise exception 'exactly one enrolment expected, got %', n; end if;
  if private.claim_whitelist(m1) <> 'not_listed' then raise exception 'a claimed row must not claim again'; end if;
  select count(*) into n from public.enrollments where member_id = m1 and course_id = course;
  if n <> 1 then raise exception 'claiming twice created % enrolments', n; end if;
  if not exists (select 1 from public.outbox_events where event_type = 'whitelist.claimed' and payload ->> 'member_id' = m1::text) then raise exception 'no outbox event'; end if;
  raise notice 'ok: claim once, different email never claims';

  -- removed and expired rows never claim; a claimed row cannot be removed
  select id into wid from public.access_whitelist where email_norm = 'unconfirmed@example.com' and course_id = course;
  if public.remove_from_learner_list(wid) <> 'removed' then raise exception 'waiting row must be removable'; end if;
  if private.claim_whitelist(m3) <> 'not_listed' then raise exception 'a removed row must not claim'; end if;
  select id into wid from public.access_whitelist where email_norm = 'listed.learner@example.com' and course_id = course;
  if public.remove_from_learner_list(wid) <> 'claimed' then raise exception 'a claimed row must not be removable'; end if;

  perform public.add_to_learner_list(t, course, null, now() + interval '1 day', '[{"email":"unconfirmed@example.com"}]'::jsonb);
  update public.access_whitelist set expires_at = now() - interval '1 minute' where email_norm = 'unconfirmed@example.com' and course_id = course;
  if private.claim_whitelist(m3) <> 'not_listed' then raise exception 'an expired row must not claim'; end if;
  if (select status from public.access_whitelist where email_norm = 'unconfirmed@example.com' and course_id = course) <> 'expired' then raise exception 'row should be marked expired'; end if;
  raise notice 'ok: removed and expired rows never claim';

  -- expiry in the past is refused at add time
  begin
    perform public.add_to_learner_list(t, course, null, now() - interval '1 day', '[{"email":"late@example.com"}]'::jsonb);
    raise exception 'a past expiry must be refused';
  exception when invalid_parameter_value then raise notice 'ok: past expiry refused'; end;

  -- RLS: a learner and anon read nothing from the list; staff read it
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from public.access_whitelist;
  if n <> 0 then raise exception 'a learner must see no list rows, saw %', n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from public.access_whitelist where course_id = course;
  if n < 1 then raise exception 'staff must see the list'; end if;
  reset role;
  set local role anon;
  begin
    perform 1 from public.access_whitelist limit 1;
    raise exception 'anon must not read the list';
  exception when insufficient_privilege then raise notice 'ok: RLS (learner none, staff yes, anon denied)'; end;
  reset role;

  -- confirming the email only reports the match; the learner presses the button to claim (plan/16 §12)
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  perform public.add_to_learner_list(t, course, null, now() + interval '1 year', '[{"email":"late.joiner@example.com"}]'::jsonb);
  declare u4 uuid := gen_random_uuid(); m4 uuid; c text; v jsonb;
  begin
    insert into auth.users (id, email, aud, role, raw_user_meta_data) values (u4, 'late.joiner@example.com', 'authenticated', 'authenticated', '{}');
    insert into public.tenant_members (tenant_id, user_id, display_name, email) values (t, u4, 'Late', 'late.joiner@example.com') returning id into m4;
    c := public.issue_email_code(m4) ->> 'code';
    perform set_config('request.jwt.claims', json_build_object('sub', u4, 'role', 'authenticated')::text, true);
    if public.my_list_match(t) is not null then raise exception 'an unconfirmed email must see no match'; end if;
    v := public.verify_email_code(t, c);
    if v ->> 'status' <> 'verified' or v ->> 'claim' <> 'listed' then raise exception 'confirming must report the match: %', v; end if;
    if exists (select 1 from public.enrollments where member_id = m4) then raise exception 'confirming must not enrol'; end if;
    if public.my_list_match(t) ->> 'course_id' <> course::text then raise exception 'match must name the course'; end if;
    if public.claim_my_list_access(t) <> 'claimed' then raise exception 'the button must claim'; end if;
    if public.claim_my_list_access(t) = 'claimed' then raise exception 'a second press must not claim again'; end if;
    select count(*) into n from public.enrollments where member_id = m4 and course_id = course;
    if n <> 1 then raise exception 'one enrolment expected, got %', n; end if;
    if public.my_list_match(t) is not null then raise exception 'nothing left to claim'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
    if public.my_list_match(t) is not null then raise exception 'another learner must see no match'; end if;
    raise notice 'ok: confirm reports the match, the button claims it once';
  end;

  -- joining a batch that is already running counts from the batch's start date
  declare u5 uuid := gen_random_uuid(); m5 uuid; b uuid;
  begin
    insert into public.batches (tenant_id, code, name, status, start_date) values (t, 'SQL-RUN', 'SQL running batch', 'ongoing', current_date - 40) returning id into b;
    perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    perform public.add_to_learner_list(t, course, b, now() + interval '1 year', '[{"email":"mid.batch@example.com"}]'::jsonb);
    insert into auth.users (id, email, aud, role, raw_user_meta_data) values (u5, 'mid.batch@example.com', 'authenticated', 'authenticated', '{}');
    insert into public.tenant_members (tenant_id, user_id, display_name, email, email_verified_at) values (t, u5, 'Mid', 'mid.batch@example.com', now()) returning id into m5;
    if private.claim_whitelist(m5) <> 'claimed' then raise exception 'mid-batch learner must claim'; end if;
    if (select (started_at at time zone 'Asia/Kolkata')::date from public.enrollments where member_id = m5) <> current_date - 40 then raise exception 'must start with the batch'; end if;
    raise notice 'ok: joining a running batch counts from its start';
  end;
end $$;

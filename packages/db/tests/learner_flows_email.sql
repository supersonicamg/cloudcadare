-- Slice 2 (plan/16 §4.1, §11): email codes. Run with `node scripts/db-test.mjs packages/db/tests/learner_flows_email.sql`
-- against a dev project. Everything happens in a transaction that is rolled back.
do $$
declare
  t   uuid := (select id from public.tenants where slug = 'cloudcadre');
  u1  uuid := gen_random_uuid();
  u2  uuid := gen_random_uuid();
  m1  uuid;
  m2  uuid;
  r   jsonb;
  c1  text;
begin
  if t is null then raise exception 'tenant cloudcadre not found'; end if;
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u1, 'sql-a@example.com', 'authenticated', 'authenticated', '{}'), (u2, 'sql-b@example.com', 'authenticated', 'authenticated', '{}');
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values (t, u1, 'A', 'sql-a@example.com') returning id into m1;
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values (t, u2, 'B', 'sql-b@example.com') returning id into m2;
  if (select email_verified_at from public.tenant_members where id = m1) is not null then raise exception 'a new member must start unconfirmed'; end if;

  -- issue: a code, then throttled for 60 seconds
  r := public.issue_email_code(m1);
  if r ->> 'status' <> 'issued' or (r ->> 'code') !~ '^[0-9]{6}$' then raise exception 'issue failed: %', r; end if;
  c1 := r ->> 'code';
  if public.issue_email_code(m1) ->> 'status' <> 'too_soon' then raise exception 'second code within 60 s must be refused'; end if;
  raise notice 'ok: issue + throttle';

  -- verify as user 1: another member cannot use this code; wrong code counts; right code confirms once
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  if public.verify_email_code(t, c1) ->> 'status' = 'verified' then raise exception 'a code must not confirm another member'; end if;
  if (select email_verified_at from public.tenant_members where id = m1) is not null then raise exception 'member 1 must still be unconfirmed'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  r := public.verify_email_code(t, case when c1 = '000000' then '111111' else '000000' end);
  if r ->> 'status' <> 'wrong' or (r ->> 'attempts_left')::int <> 4 then raise exception 'wrong code: %', r; end if;
  r := public.verify_email_code(t, c1);
  if r ->> 'status' <> 'verified' then raise exception 'right code refused: %', r; end if;
  if (select email_verified_at from public.tenant_members where id = m1) is null then raise exception 'email_verified_at not set'; end if;
  if public.verify_email_code(t, c1) ->> 'status' <> 'verified' then raise exception 'verify must be idempotent'; end if;
  raise notice 'ok: wrong, right, idempotent, not transferable';

  -- lock after five wrong tries (member 2)
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  r := public.issue_email_code(m2);
  c1 := r ->> 'code';
  for i in 1..5 loop
    perform public.verify_email_code(t, case when c1 = '000000' then '111111' else '000000' end);
  end loop;
  if public.verify_email_code(t, c1) ->> 'status' <> 'locked' then raise exception 'five wrong codes must lock the code'; end if;
  raise notice 'ok: lock after five wrong tries';

  -- an expired code is refused
  update public.email_verifications set attempts = 0, expires_at = now() - interval '1 second' where member_id = m2;
  if public.verify_email_code(t, c1) ->> 'status' <> 'expired' then raise exception 'expired code must be refused'; end if;
  raise notice 'ok: expiry';

  -- learners cannot read the codes table or call issue_email_code
  set local role authenticated;
  begin
    perform 1 from public.email_verifications limit 1;
    raise exception 'authenticated must not read email_verifications';
  exception when insufficient_privilege then raise notice 'ok: codes table is closed to learners'; end;
  begin
    perform public.issue_email_code(m2);
    raise exception 'authenticated must not call issue_email_code';
  exception when insufficient_privilege then raise notice 'ok: issue_email_code is service-only'; end;
  begin
    update public.tenant_members set email_verified_at = now() where id = m2;
    raise exception 'authenticated must not write email_verified_at';
  exception when insufficient_privilege then raise notice 'ok: email_verified_at is not writable by learners'; end;
  reset role;
end $$;

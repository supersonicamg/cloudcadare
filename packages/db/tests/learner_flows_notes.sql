-- Slice 6 (plan/16 §6.3-6.4, §11): notes are private and only for lessons you can open; joining a live class.
-- Run with `node scripts/db-test.mjs packages/db/tests/learner_flows_notes.sql`. Rolled back at the end.
do $$
declare
  t   uuid := (select id from public.tenants where slug = 'cloudcadre');
  staff uuid;
  u1 uuid := gen_random_uuid();  m1 uuid;   -- enrolled learner
  u2 uuid := gen_random_uuid();  m2 uuid;   -- enrolled learner (another)
  u3 uuid := gen_random_uuid();  m3 uuid;   -- not enrolled
  course uuid; sec uuid; les uuid; les2 uuid;
  s_open uuid; s_future uuid; s_over uuid;
  n int; r text; nid uuid;
begin
  select m.user_id into staff from public.member_roles mr
    join public.role_permissions rp on rp.role_id = mr.role_id and rp.permission_key = 'enrollment.manage'
    join public.tenant_members m on m.id = mr.member_id
   where mr.tenant_id = t and mr.scope_type = 'tenant' and m.user_id is not null limit 1;

  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u1, 'note-a@example.com', 'authenticated', 'authenticated', '{}'),
    (u2, 'note-b@example.com', 'authenticated', 'authenticated', '{}'),
    (u3, 'note-c@example.com', 'authenticated', 'authenticated', '{}');
  insert into public.tenant_members (tenant_id, user_id, display_name, email, email_verified_at) values (t, u1, 'A', 'note-a@example.com', now()) returning id into m1;
  insert into public.tenant_members (tenant_id, user_id, display_name, email, email_verified_at) values (t, u2, 'B', 'note-b@example.com', now()) returning id into m2;
  insert into public.tenant_members (tenant_id, user_id, display_name, email, email_verified_at) values (t, u3, 'C', 'note-c@example.com', now()) returning id into m3;

  insert into public.courses (tenant_id, slug, title, status) values (t, 'sql-notes-course', 'SQL notes course', 'published') returning id into course;
  insert into public.course_sections (tenant_id, course_id, title, is_published) values (t, course, 'Month 1', true) returning id into sec;
  insert into public.lessons (tenant_id, course_id, section_id, type, title, is_published) values (t, course, sec, 'video', 'Lesson one', true) returning id into les;
  insert into public.lessons (tenant_id, course_id, section_id, type, title, is_published) values (t, course, sec, 'pdf', 'Lesson two', true) returning id into les2;
  insert into public.enrollments (tenant_id, member_id, course_id, source) values (t, m1, course, 'admin'), (t, m2, course, 'admin');

  set local role authenticated;

  -- an enrolled learner writes a note, a bookmark and a highlight
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, position_seconds, body) values (t, m1, les, 'note', 1634, 'Tags are the key') returning id into nid;
  insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, position_seconds) values (t, m1, les, 'bookmark', 760);
  insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, page_no, body) values (t, m1, les2, 'highlight', 3, 'cost allocation tag');
  raise notice 'ok: note, bookmark and highlight saved';

  -- rules on the shape of a note
  begin insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, body) values (t, m1, les, 'note', '   '); raise exception 'an empty note must be refused';
  exception when check_violation then raise notice 'ok: an empty note is refused'; end;
  begin insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, body) values (t, m1, les, 'note', repeat('x', 4001)); raise exception 'a huge note must be refused';
  exception when check_violation then raise notice 'ok: a 4001-character note is refused'; end;
  begin insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, body, position_seconds, page_no) values (t, m1, les, 'note', 'x', 5, 2); raise exception 'a time and a page together must be refused';
  exception when check_violation then raise notice 'ok: a note has a time or a page, not both'; end;

  -- nobody else reads them: another learner, an outsider, and staff
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  select count(*) into n from public.lesson_notes;
  if n <> 0 then raise exception 'another learner must not read notes, saw %', n; end if;
  update public.lesson_notes set body = 'hijack' where id = nid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'another learner must not edit notes'; end if;
  delete from public.lesson_notes where id = nid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'another learner must not delete notes'; end if;
  begin insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, body) values (t, m1, les, 'note', 'as someone else'); raise exception 'writing as another member must be refused';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  select count(*) into n from public.lesson_notes where member_id = m1;
  if n <> 0 then raise exception 'staff must not read learners'' notes, saw %', n; end if;
  set local role anon;
  perform set_config('request.jwt.claims', '{}', true);
  begin select count(*) into n from public.lesson_notes; if n <> 0 then raise exception 'anon must read nothing'; end if;
  exception when insufficient_privilege then null; end;
  set local role authenticated;
  raise notice 'ok: notes are private (other learner, staff, anon see nothing)';

  -- a learner who is not enrolled cannot add a note to a lesson they cannot open
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, body) values (t, m3, les, 'note', 'sneaky'); raise exception 'no note on a lesson you cannot open';
  exception when insufficient_privilege then raise notice 'ok: no notes on lessons you cannot open'; end;

  -- the owner edits text, but cannot move a note to another lesson or kind
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  update public.lesson_notes set body = 'Tags are the key to allocation', lesson_id = les2, kind = 'highlight' where id = nid;
  if (select lesson_id from public.lesson_notes where id = nid) <> les or (select kind from public.lesson_notes where id = nid) <> 'note' then raise exception 'a note must stay on its lesson and keep its kind'; end if;
  delete from public.lesson_notes where id = nid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'the owner deletes their own note'; end if;
  raise notice 'ok: edit keeps lesson and kind; the owner can delete';

  -- the cap: 500 per learner per lesson
  reset role;
  insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, position_seconds, body)
    select t, m2, les, 'note', g, 'n' || g from generate_series(1, 500) g;
  begin
    insert into public.lesson_notes (tenant_id, member_id, lesson_id, kind, position_seconds, body) values (t, m2, les, 'note', 501, 'one too many');
    raise exception 'the 501st note must be refused';
  exception when raise_exception then if sqlerrm <> 'too_many_notes' then raise; end if; raise notice 'ok: at most 500 notes per lesson'; end;

  -- joining a live class: only in the window, only if enrolled, attendance once
  insert into public.live_sessions (tenant_id, course_id, title, starts_at, ends_at, join_url, status)
    values (t, course, 'Open now', now() - interval '5 minutes', now() + interval '55 minutes', 'https://meet.example.com/open', 'scheduled') returning id into s_open;
  insert into public.live_sessions (tenant_id, course_id, title, starts_at, ends_at, join_url, status)
    values (t, course, 'Tomorrow', now() + interval '1 day', now() + interval '1 day 1 hour', 'https://meet.example.com/later', 'scheduled') returning id into s_future;
  insert into public.live_sessions (tenant_id, course_id, title, starts_at, ends_at, join_url, status)
    values (t, course, 'Finished', now() - interval '3 hours', now() - interval '2 hours', 'https://meet.example.com/done', 'completed') returning id into s_over;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  r := public.join_live_session(s_open);
  if r <> 'https://meet.example.com/open' then raise exception 'join must return the link'; end if;
  r := public.join_live_session(s_open);
  reset role;
  select count(*) into n from public.attendance_records where live_session_id = s_open and member_id = m1;
  if n <> 1 then raise exception 'attendance must be recorded exactly once, saw %', n; end if;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin perform public.join_live_session(s_future); raise exception 'a class tomorrow must not open now';
  exception when raise_exception then if sqlerrm <> 'not_open_yet' then raise; end if; raise notice 'ok: the link is closed before the window'; end;
  begin perform public.join_live_session(s_over); raise exception 'a finished class must not open';
  exception when raise_exception then if sqlerrm <> 'session_over' then raise; end if; end;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin perform public.join_live_session(s_open); raise exception 'someone not enrolled must not join';
  exception when no_data_found then raise notice 'ok: only enrolled learners join; attendance once'; end;
  reset role;
end $$;

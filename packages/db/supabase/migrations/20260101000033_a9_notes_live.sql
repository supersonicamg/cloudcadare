-- =============================================================================
-- a9_notes_live.sql  —  learner notes hardened, and joining a live class (plan/16 §6.3, §6.4)
-- Slice 6.
--  1. `lesson_notes` already exists with an owner-only policy: a learner reads and writes only their own rows and staff
--     have NO policy, so staff cannot read notes. What was missing: any note could be written for any lesson of the
--     academy (including ones the learner cannot open), with no size limit and no limit on how many. Fixed here.
--  2. `join_live_session`: the only way a learner reaches a class link. It opens 10 minutes before the start and closes
--     at the end, checks the learner may see the class, and records attendance once (attendance has no learner policy).
-- =============================================================================

-- ---------------------------------------------------------------- notes: shape
alter table public.lesson_notes
  add constraint lesson_notes_body_len check (body is null or char_length(body) <= 4000),
  add constraint lesson_notes_pos_ok check (position_seconds is null or position_seconds between 0 and 86400),
  add constraint lesson_notes_page_ok check (page_no is null or page_no between 1 and 5000),
  -- a note and a highlight say something; a bookmark may be only a mark
  add constraint lesson_notes_body_needed check (kind = 'bookmark' or nullif(btrim(body), '') is not null),
  add constraint lesson_notes_one_place check (position_seconds is null or page_no is null);
create index if not exists lesson_notes_member_recent_idx on public.lesson_notes (member_id, created_at desc);

-- At most 500 per learner per lesson: a stuck client cannot fill the table.
create or replace function private.lesson_notes_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.lesson_notes n where n.member_id = new.member_id and n.lesson_id = new.lesson_id) >= 500 then
      raise exception 'too_many_notes' using errcode = 'P0001';
    end if;
  else
    -- who and what a note belongs to never changes; only its text and place do
    new.member_id := old.member_id; new.lesson_id := old.lesson_id; new.tenant_id := old.tenant_id; new.kind := old.kind;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists lesson_notes_guard on public.lesson_notes;
create trigger lesson_notes_guard before insert or update on public.lesson_notes for each row execute function private.lesson_notes_guard();

-- ---------------------------------------------------------------- notes: who may write
-- Read stays owner-only. Writing needs a lesson the learner can open right now (RLS on `lessons` answers that: enrolled
-- and not expired, or a free preview). Deleting a note is always allowed to its owner.
drop policy if exists lesson_notes_owner_all on public.lesson_notes;
create policy lesson_notes_owner_select on public.lesson_notes for select to authenticated
  using (member_id in (select private.my_member_ids()));
create policy lesson_notes_owner_insert on public.lesson_notes for insert to authenticated
  with check (member_id in (select private.my_member_ids()) and lesson_id in (select l.id from public.lessons l));
create policy lesson_notes_owner_update on public.lesson_notes for update to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()) and lesson_id in (select l.id from public.lessons l));
create policy lesson_notes_owner_delete on public.lesson_notes for delete to authenticated
  using (member_id in (select private.my_member_ids()));

-- ---------------------------------------------------------------- live class: join
create or replace function public.join_live_session(p_session uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_s public.live_sessions;
  v_m public.tenant_members;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_s from public.live_sessions where id = p_session;
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  select * into v_m from public.tenant_members where tenant_id = v_s.tenant_id and user_id = (select auth.uid()) and status = 'active';
  if not found then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  -- the learner must be in the class's batch or enrolled in its course (the same rule as who may read the session)
  if not (v_s.batch_id in (select private.my_batch_ids()) or v_s.course_id in (select private.my_course_ids())) then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if v_s.status = 'cancelled' then raise exception 'session_cancelled' using errcode = 'P0001'; end if;
  if now() < v_s.starts_at - interval '10 minutes' then raise exception 'not_open_yet' using errcode = 'P0001'; end if;
  if now() > v_s.ends_at then raise exception 'session_over' using errcode = 'P0001'; end if;
  if v_s.join_url is null then raise exception 'no_link' using errcode = 'P0001'; end if;

  insert into public.attendance_records (tenant_id, live_session_id, member_id, status, joined_at, source)
  values (v_s.tenant_id, v_s.id, v_m.id, case when now() > v_s.starts_at + interval '10 minutes' then 'late' else 'present' end, now(), 'auto')
  on conflict (live_session_id, member_id) do nothing;
  return v_s.join_url;
end $$;
revoke all on function public.join_live_session(uuid) from public, anon;
grant execute on function public.join_live_session(uuid) to authenticated;

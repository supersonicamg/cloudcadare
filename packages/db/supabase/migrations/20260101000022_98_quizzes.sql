-- =============================================================================
-- 98_quizzes.sql  —  authoring and reading quizzes (the engine itself is in 90_functions.sql)
-- Added in Phase 1 slice 6.
--   save_quiz_question / delete_quiz_question : staff write a question, its answer key and its place in a test in ONE step
--   get_test_overview                         : what the learner sees before starting (counts, limits, own attempts)
--   get_attempt_result                        : the learner's result and, when allowed, a review with the right answers
-- Answer keys never leave the database except through get_attempt_result, after the attempt is closed.
-- Question content: stem {"text": …}; options [{"id":"a","content":{"text": …}}]; key {"correct":["a"]}.
-- Learner response shapes the grader expects: mcq_single / true_false {"selected":"a"}; mcq_multi {"selected":["a","c"]}.
-- =============================================================================

-- total_marks, and pass_marks from the test's own pass percentage (settings.pass_pct)
create or replace function private.refresh_test_totals(p_test uuid)
returns void
language sql security definer set search_path = '' as $$
  with s as (
    select coalesce(sum(coalesce(tq.marks, q.default_marks)), 0) as total
    from public.test_questions tq join public.questions q on q.id = tq.question_id and q.deleted_at is null
    where tq.test_id = p_test
  )
  update public.tests t
     set total_marks = s.total,
         pass_marks  = case when nullif(t.settings ->> 'pass_pct', '') is null then null
                            else round(s.total * (t.settings ->> 'pass_pct')::numeric / 100, 2) end
    from s where t.id = p_test
$$;

create or replace function public.save_quiz_question(
  p_test_id uuid, p_question_id uuid, p_type text, p_text text, p_options jsonb, p_correct text[], p_marks numeric, p_explanation text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_t       public.tests;
  v_member  uuid;
  v_opts    jsonb;
  v_ids     text[];
  v_q       uuid := p_question_id;
  v_stem    jsonb;
  v_expl    jsonb;
begin
  select * into v_t from public.tests t where t.id = p_test_id and t.deleted_at is null;
  if not found then raise exception 'test_not_found' using errcode = 'P0002'; end if;
  if not (private.has_perm(v_t.tenant_id, 'question.manage') and private.has_perm(v_t.tenant_id, 'test.manage')) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not private.feature_enabled(v_t.tenant_id, 'assess.quizzes') then raise exception 'feature_disabled:assess.quizzes' using errcode = '42501'; end if;
  select m.id into v_member from public.tenant_members m where m.tenant_id = v_t.tenant_id and m.user_id = (select auth.uid()) and m.status = 'active';

  if p_type not in ('mcq_single', 'mcq_multi', 'true_false') then raise exception 'question_type_unsupported' using errcode = 'P0001'; end if;
  if nullif(trim(coalesce(p_text, '')), '') is null or length(p_text) > 4000 then raise exception 'question_text_invalid' using errcode = 'P0001'; end if;
  if p_marks is null or p_marks <= 0 or p_marks > 100 then raise exception 'marks_invalid' using errcode = 'P0001'; end if;

  if p_type = 'true_false' then
    v_opts := jsonb_build_array(jsonb_build_object('id', 'true', 'content', jsonb_build_object('text', 'True')),
                                jsonb_build_object('id', 'false', 'content', jsonb_build_object('text', 'False')));
  else
    if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 8 then raise exception 'options_invalid' using errcode = 'P0001'; end if;
    select jsonb_agg(jsonb_build_object('id', o ->> 'id', 'content', jsonb_build_object('text', trim(o ->> 'text'))) order by ord)
      into v_opts
      from jsonb_array_elements(p_options) with ordinality as t(o, ord);
    if exists (select 1 from jsonb_array_elements(v_opts) o where nullif(o -> 'content' ->> 'text', '') is null or (o ->> 'id') !~ '^[a-h]$') then raise exception 'options_invalid' using errcode = 'P0001'; end if;
  end if;
  select array_agg(o ->> 'id') into v_ids from jsonb_array_elements(v_opts) o;
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'options_invalid' using errcode = 'P0001'; end if;
  if p_correct is null or cardinality(p_correct) = 0 or not (p_correct <@ v_ids) then raise exception 'answer_invalid' using errcode = 'P0001'; end if;
  if p_type <> 'mcq_multi' and cardinality(p_correct) <> 1 then raise exception 'answer_invalid' using errcode = 'P0001'; end if;

  v_stem := jsonb_build_object('text', trim(p_text));
  v_expl := case when nullif(trim(coalesce(p_explanation, '')), '') is null then null else jsonb_build_object('text', trim(p_explanation)) end;

  if v_q is null then
    insert into public.questions (tenant_id, type, stem, options, explanation, default_marks, status, created_by)
    values (v_t.tenant_id, p_type, v_stem, v_opts, v_expl, p_marks, 'approved', v_member) returning id into v_q;
    insert into public.test_questions (tenant_id, test_id, question_id, position)
    values (v_t.tenant_id, v_t.id, v_q, coalesce((select max(position) from public.test_questions where test_id = v_t.id), 0) + 1);
  else
    if not exists (select 1 from public.test_questions tq where tq.test_id = v_t.id and tq.question_id = v_q) then raise exception 'question_not_found' using errcode = 'P0002'; end if;
    update public.questions set type = p_type, stem = v_stem, options = v_opts, explanation = v_expl, default_marks = p_marks, version = version + 1
     where id = v_q and tenant_id = v_t.tenant_id;
  end if;
  insert into public.question_keys (question_id, tenant_id, answer) values (v_q, v_t.tenant_id, jsonb_build_object('correct', to_jsonb(p_correct)))
  on conflict (question_id) do update set answer = excluded.answer;

  perform private.refresh_test_totals(v_t.id);
  return v_q;
end $$;

create or replace function public.delete_quiz_question(p_test_id uuid, p_question_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_t public.tests;
begin
  select * into v_t from public.tests t where t.id = p_test_id and t.deleted_at is null;
  if not found then raise exception 'test_not_found' using errcode = 'P0002'; end if;
  if not (private.has_perm(v_t.tenant_id, 'question.manage') and private.has_perm(v_t.tenant_id, 'test.manage')) then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.test_questions where test_id = p_test_id and question_id = p_question_id;
  update public.questions set deleted_at = now()
   where id = p_question_id and tenant_id = v_t.tenant_id and not exists (select 1 from public.test_questions x where x.question_id = p_question_id);
  perform private.refresh_test_totals(p_test_id);
end $$;

-- A learner's view of a test before starting: limits, and their own earlier attempts.
create or replace function public.get_test_overview(p_test_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t        public.tests;
  v_member uuid;
  v_shown  boolean;
begin
  select * into t from public.tests where id = p_test_id and status = 'published' and deleted_at is null;
  if not found then raise exception 'test_not_available' using errcode = 'P0002'; end if;
  select m.id into v_member from public.tenant_members m where m.tenant_id = t.tenant_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if v_member is null then raise exception 'not_a_member' using errcode = '42501'; end if;
  if t.course_id is not null and not exists (
       select 1 from public.enrollments e where e.member_id = v_member and e.course_id = t.course_id and e.status in ('active', 'completed') and (e.expires_at is null or e.expires_at > now())) then
    raise exception 'not_enrolled' using errcode = '42501';
  end if;
  v_shown := t.result_visibility = 'immediate' or t.results_published_at is not null;

  return jsonb_build_object(
    'test_id', t.id, 'title', t.title, 'instructions', t.instructions ->> 'text',
    'question_count', (select count(*) from public.test_questions tq join public.questions q on q.id = tq.question_id and q.deleted_at is null where tq.test_id = t.id),
    'duration_seconds', t.duration_seconds, 'max_attempts', t.max_attempts, 'pass_pct', nullif(t.settings ->> 'pass_pct', '')::numeric,
    'total_marks', t.total_marks, 'results_shown', v_shown,
    'open_attempt_id', (select a.id from public.test_attempts a where a.test_id = t.id and a.member_id = v_member and a.status = 'in_progress'
                         and (a.deadline_at is null or now() <= a.deadline_at + make_interval(secs => t.grace_seconds))),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', a.id, 'attempt_no', a.attempt_no, 'status', a.status, 'submitted_at', a.submitted_at,
                  'score', case when v_shown then a.score end, 'max_score', a.max_score,
                  'percentage', case when v_shown then a.percentage end, 'is_passed', case when v_shown then a.is_passed end) order by a.attempt_no desc)
                from public.test_attempts a where a.test_id = t.id and a.member_id = v_member and a.status <> 'in_progress' and a.status <> 'invalidated'), '[]'::jsonb));
end $$;

-- The learner's own closed attempt. The review (with the right answers) follows the test's answer_visibility.
create or replace function public.get_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  a        public.test_attempts;
  t        public.tests;
  v_shown  boolean;
  v_review boolean;
begin
  select at.* into a from public.test_attempts at join public.tenant_members m on m.id = at.member_id
   where at.id = p_attempt_id and m.user_id = (select auth.uid());
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status = 'in_progress' then raise exception 'attempt_open' using errcode = 'P0001'; end if;
  select * into t from public.tests where id = a.test_id;
  v_shown  := t.result_visibility = 'immediate' or t.results_published_at is not null;
  v_review := v_shown and (t.answer_visibility = 'after_submit' or (t.answer_visibility in ('after_close', 'manual') and t.results_published_at is not null));

  return jsonb_build_object(
    'attempt_id', a.id, 'test_id', t.id, 'title', t.title, 'attempt_no', a.attempt_no, 'status', a.status,
    'results_shown', v_shown, 'review_shown', v_review,
    'score', case when v_shown then a.score end, 'max_score', a.max_score, 'percentage', case when v_shown then a.percentage end,
    'correct', case when v_shown then a.correct_count end, 'incorrect', case when v_shown then a.incorrect_count end,
    'unattempted', case when v_shown then a.unattempted_count end, 'is_passed', case when v_shown then a.is_passed end,
    'time_taken_seconds', a.time_taken_seconds,
    'review', case when not v_review then null else (
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'type', q.type, 'text', q.stem ->> 'text', 'options', q.options,
               'selected', aa.response -> 'selected', 'correct', k.answer -> 'correct',
               'is_correct', aa.is_correct, 'marks', aa.marks_awarded, 'max_marks', (p.e ->> 'm')::numeric,
               'explanation', q.explanation ->> 'text') order by p.ord)
        from jsonb_array_elements(a.paper) with ordinality as p(e, ord)
        join public.questions q on q.id = (p.e ->> 'q')::uuid
        left join public.question_keys k on k.question_id = q.id
        left join public.attempt_answers aa on aa.attempt_id = a.id and aa.question_id = q.id) end);
end $$;

revoke execute on function private.refresh_test_totals(uuid) from public;
revoke execute on function public.save_quiz_question(uuid, uuid, text, text, jsonb, text[], numeric, text), public.delete_quiz_question(uuid, uuid),
  public.get_test_overview(uuid), public.get_attempt_result(uuid) from public, anon;
grant  execute on function public.save_quiz_question(uuid, uuid, text, text, jsonb, text[], numeric, text), public.delete_quiz_question(uuid, uuid),
  public.get_test_overview(uuid), public.get_attempt_result(uuid) to authenticated;

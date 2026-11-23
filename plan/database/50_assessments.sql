-- =============================================================================
-- 50_assessments.sql  —  schema: public
-- Question bank, tests (quiz → full NEET/JEE/UPSC mock with sections & negative
-- marking), attempts, answers, assignments.
--
-- INTEGRITY RULES
--   * Correct answers live in question_keys – no API role can ever read it.
--   * Learners never query questions/attempts tables directly; they use the
--     security-definer RPCs start_test_attempt / get_attempt_paper /
--     save_attempt_answer / submit_test_attempt (90_functions.sql).
--   * Deadlines are enforced server-side from test_attempts.deadline_at.
-- =============================================================================

create table public.questions (
  id                     uuid primary key default private.uuid7(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  type                   text not null check (type in ('mcq_single', 'mcq_multi', 'true_false', 'numeric', 'fill_blank',
                                                       'match', 'ordering', 'assertion_reason', 'subjective', 'code', 'passage')),
  passage_id             uuid,                 -- child questions of a comprehension passage
  stem                   jsonb not null,       -- rich content (text, LaTeX, images)
  options                jsonb not null default '[]',   -- [{"id":"a","content":{…}}]  — NO correctness flags here
  explanation            jsonb,                -- solution, shown per test.answer_visibility
  hints                  jsonb,
  subject_term_id        uuid,
  topic_term_id          uuid,
  tags                   text[] not null default '{}',
  difficulty             smallint check (difficulty between 1 and 5),
  default_marks          numeric(6,2) not null default 1,
  default_negative_marks numeric(6,2) not null default 0 check (default_negative_marks >= 0),
  language               text not null default 'en',
  translations           jsonb not null default '{}',   -- {"hi":{"stem":…,"options":…,"explanation":…}}
  source                 text,
  exam_year              smallint,              -- previous-year question
  status                 text not null default 'draft' check (status in ('draft', 'review', 'approved', 'archived')),
  version                int not null default 1,
  created_by             uuid,
  reviewed_by            uuid,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, passage_id)      references public.questions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, subject_term_id) references public.taxonomy_terms(tenant_id, id) on delete set null (subject_term_id),
  foreign key (tenant_id, topic_term_id)   references public.taxonomy_terms(tenant_id, id) on delete set null (topic_term_id)
);
create index questions_bank_idx on public.questions (tenant_id, status, subject_term_id, topic_term_id, difficulty) where deleted_at is null;
create index questions_tags_idx on public.questions using gin (tags);

-- Answer keys. Formats by question type:
--   mcq_single / true_false / assertion_reason : {"correct":["b"]}
--   mcq_multi   : {"correct":["a","c"]}            grading: {"partial":true}
--   numeric     : {"value":9.8,"tolerance":0.05}
--   fill_blank  : {"accepted":["mitochondria","mitochondrion"],"case_sensitive":false}
--   match/ordering/subjective/code : graded manually or by worker
create table public.question_keys (
  question_id uuid primary key,
  tenant_id   uuid not null,
  answer      jsonb not null,
  grading     jsonb not null default '{}',
  foreign key (tenant_id, question_id) references public.questions(tenant_id, id) on delete cascade
);

-- Item analysis (recomputed by worker): difficulty & discrimination per question.
create table public.question_stats (
  question_id          uuid primary key,
  tenant_id            uuid not null,
  attempts_count       int not null default 0,
  correct_count        int not null default 0,
  avg_time_seconds     numeric(8,2),
  discrimination_index numeric(5,3),
  updated_at           timestamptz not null default now(),
  foreign key (tenant_id, question_id) references public.questions(tenant_id, id) on delete cascade
);

create table public.tests (
  id                uuid primary key default private.uuid7(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  course_id         uuid,
  kind              text not null default 'quiz' check (kind in ('quiz', 'practice', 'mock', 'sectional', 'exam', 'diagnostic', 'survey')),
  title             text not null,
  slug              extensions.citext,
  description       text,
  instructions      jsonb,
  duration_seconds  int check (duration_seconds > 0),       -- NULL = untimed
  total_marks       numeric(8,2) not null default 0,         -- maintained from test_questions / sections
  pass_marks        numeric(8,2),
  max_attempts      int check (max_attempts > 0),            -- NULL = unlimited
  shuffle_questions boolean not null default false,
  shuffle_options   boolean not null default false,
  negative_marking  boolean not null default false,
  result_visibility text not null default 'immediate' check (result_visibility in ('immediate', 'after_close', 'manual', 'never')),
  answer_visibility text not null default 'after_submit' check (answer_visibility in ('after_submit', 'after_close', 'manual', 'never')),
  available_from    timestamptz,
  available_until   timestamptz,
  grace_seconds     int not null default 30,                 -- network-lag tolerance on deadline
  settings          jsonb not null default '{}',             -- {"section_lock":true,"calculator":false,"fullscreen":true,"tab_switch_limit":3}
  status            text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  results_published_at timestamptz,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, slug),
  check (available_until is null or available_from is null or available_until > available_from),
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete set null (course_id)
);
create index tests_course_idx on public.tests (tenant_id, course_id, status);

create table public.test_sections (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null,
  test_id            uuid not null,
  title              text not null,
  instructions       jsonb,
  position           int not null default 0,
  duration_seconds   int check (duration_seconds > 0),     -- sectional timing (CAT/UPSC CSAT style)
  question_selection jsonb not null default '{"mode":"static"}',
  -- random pool: {"mode":"random","count":25,"filter":{"subject_term_id":"…","difficulty":[2,3],"tags":["pyq"]}}
  marks_per_question numeric(6,2),
  negative_marks     numeric(6,2),
  unique (tenant_id, id),
  unique (test_id, id),
  foreign key (tenant_id, test_id) references public.tests(tenant_id, id) on delete cascade
);

create table public.test_questions (
  tenant_id      uuid not null,
  test_id        uuid not null,
  section_id     uuid,
  question_id    uuid not null,
  position       int not null default 0,
  marks          numeric(6,2),             -- NULL → section → question default
  negative_marks numeric(6,2),
  primary key (test_id, question_id),
  foreign key (tenant_id, test_id)     references public.tests(tenant_id, id) on delete cascade,
  foreign key (test_id, section_id)    references public.test_sections(test_id, id) on delete cascade,
  foreign key (tenant_id, question_id) references public.questions(tenant_id, id) on delete restrict
);

create table public.test_attempts (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null,
  test_id            uuid not null,
  member_id          uuid not null,
  enrollment_id      uuid,
  attempt_no         int not null,
  status             text not null default 'in_progress'
                     check (status in ('in_progress', 'submitted', 'auto_submitted', 'graded', 'abandoned', 'invalidated')),
  paper              jsonb not null,       -- snapshot: [{"q":uuid,"s":section_id,"m":marks,"n":negative}] in delivery order
  started_at         timestamptz not null default now(),
  deadline_at        timestamptz,          -- server-enforced end time
  submitted_at       timestamptz,
  score              numeric(8,2),
  max_score          numeric(8,2),
  percentage         numeric(5,2),
  correct_count      int,
  incorrect_count    int,
  unattempted_count  int,
  pending_manual     int not null default 0,    -- subjective answers awaiting a grader
  time_taken_seconds int,
  rank               int,
  percentile         numeric(5,2),
  is_passed          boolean,
  graded_at          timestamptz,
  graded_by          uuid,
  client_meta        jsonb not null default '{}',   -- ip, ua, device
  proctor_flags      jsonb not null default '[]',   -- tab switches, fullscreen exits
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, id),
  unique (test_id, member_id, attempt_no),
  foreign key (tenant_id, test_id)       references public.tests(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id)     references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete set null (enrollment_id)
);
create unique index test_attempts_one_open_uk on public.test_attempts (test_id, member_id) where status = 'in_progress';
create index test_attempts_member_idx on public.test_attempts (member_id, created_at desc);
create index test_attempts_rank_idx   on public.test_attempts (test_id, score desc, time_taken_seconds) where status = 'graded';

create table public.attempt_answers (
  tenant_id          uuid not null,
  attempt_id         uuid not null,
  question_id        uuid not null,
  response           jsonb,                -- shape mirrors question_keys formats
  is_correct         boolean,
  marks_awarded      numeric(6,2),
  time_spent_seconds int not null default 0,
  flagged            boolean not null default false,   -- "mark for review"
  answered_at        timestamptz not null default now(),
  grader_feedback    text,
  graded_by          uuid,
  primary key (attempt_id, question_id),
  foreign key (tenant_id, attempt_id) references public.test_attempts(tenant_id, id) on delete cascade
);
create index attempt_answers_question_idx on public.attempt_answers (question_id);

-- ---------------------------------------------------------------- assignments
create table public.assignments (
  id               uuid primary key default private.uuid7(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  course_id        uuid,
  batch_id         uuid,
  title            text not null,
  instructions     jsonb,
  submission_types text[] not null default '{file,text}' check (submission_types <@ '{file,text,url,code}'),
  max_marks        numeric(8,2),
  rubric           jsonb,
  due_at           timestamptz,
  allow_late       boolean not null default true,
  max_attempts     int not null default 1 check (max_attempts > 0),
  status           text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade,
  foreign key (tenant_id, batch_id)  references public.batches(tenant_id, id) on delete cascade
);

create table public.assignment_submissions (
  id            uuid primary key default private.uuid7(),
  tenant_id     uuid not null,
  assignment_id uuid not null,
  member_id     uuid not null,
  attempt_no    int not null default 1,
  content       jsonb,                  -- text / url / code
  attachments   uuid[] not null default '{}',   -- media_assets ids (bucket: submissions)
  status        text not null default 'submitted' check (status in ('draft', 'submitted', 'late', 'graded', 'returned')),
  submitted_at  timestamptz,
  marks         numeric(8,2),
  feedback      jsonb,
  graded_by     uuid,
  graded_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, member_id, attempt_no),
  foreign key (tenant_id, assignment_id) references public.assignments(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id)     references public.tenant_members(tenant_id, id) on delete cascade
);
create index assignment_submissions_grading_idx on public.assignment_submissions (tenant_id, status) where status in ('submitted', 'late');

-- lessons → tests / assignments (declared here because of file order)
alter table public.lessons
  add constraint lessons_test_fk       foreign key (tenant_id, test_id)       references public.tests(tenant_id, id)       on delete set null (test_id),
  add constraint lessons_assignment_fk foreign key (tenant_id, assignment_id) references public.assignments(tenant_id, id) on delete set null (assignment_id);

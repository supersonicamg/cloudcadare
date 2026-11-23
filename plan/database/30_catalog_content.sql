-- =============================================================================
-- 30_catalog_content.sql  —  schema: public
-- Courses & curriculum (any depth: Phase › Month › Week › Lesson), batches /
-- cohorts, live classes, attendance, and instructor syllabus tracking.
--
-- One "course" abstraction covers every product shape via courses.kind:
--   course        – structured learning with progress (cloud, skill courses)
--   material_pack – study material only, no progress gating (cheap "PDF seller" plan)
--   test_series   – a curriculum whose lessons are tests (NEET/JEE/UPSC mock series)
--   live_program  – schedule-driven, lessons are mostly live sessions + recordings
-- =============================================================================

create table public.courses (
  id                   uuid primary key default private.uuid7(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  kind                 text not null default 'course' check (kind in ('course', 'material_pack', 'test_series', 'live_program')),
  slug                 extensions.citext not null,
  title                text not null,
  subtitle             text,
  summary              text,
  description          jsonb,                      -- rich text document (Tiptap/Lexical JSON)
  cover_path           text,
  trailer_media_id     uuid,
  category_term_id     uuid,
  tags                 text[] not null default '{}',
  level                text not null default 'all' check (level in ('beginner', 'intermediate', 'advanced', 'all')),
  language             text not null default 'en',
  delivery_mode        text not null default 'self_paced' check (delivery_mode in ('self_paced', 'cohort', 'live', 'hybrid', 'offline')),
  status               text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  visibility           text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  access_duration_days int check (access_duration_days > 0),   -- NULL = lifetime access
  estimated_minutes    int check (estimated_minutes >= 0),
  lesson_count         int not null default 0,     -- published mandatory lessons (maintained by trigger)
  settings             jsonb not null default '{}',-- {"sequential":true,"completion_threshold_pct":100,"certificate_template_id":"…"}
  outcomes             text[] not null default '{}',
  requirements         text[] not null default '{}',
  seo                  jsonb not null default '{}',
  custom_fields        jsonb not null default '{}',
  sort_order           int not null default 0,
  search_vector        tsvector generated always as (
                         to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(summary, ''))
                       ) stored,
  published_at         timestamptz,
  created_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, slug),
  foreign key (tenant_id, category_term_id) references public.taxonomy_terms(tenant_id, id) on delete set null (category_term_id),
  foreign key (tenant_id, trailer_media_id) references public.media_assets(tenant_id, id) on delete set null (trailer_media_id)
);
create index courses_listing_idx on public.courses (tenant_id, status, visibility, sort_order) where deleted_at is null;
create index courses_search_idx  on public.courses using gin (search_vector);
create index courses_tags_idx    on public.courses using gin (tags);

create table public.course_instructors (
  tenant_id  uuid not null,
  course_id  uuid not null,
  member_id  uuid not null,
  role       text not null default 'instructor' check (role in ('lead', 'instructor', 'assistant')),
  sort_order int not null default 0,
  primary key (course_id, member_id),
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);
create index course_instructors_member_idx on public.course_instructors (member_id);

-- Nestable sections. "label" is free text so each academy names its structure
-- (Phase 1 / Month 2 / Week 3 / Unit / Chapter / Module).
create table public.course_sections (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid not null,
  course_id    uuid not null,
  parent_id    uuid,
  label        text,
  title        text not null,
  description  text,
  position     int not null default 0,
  unlock_rule  jsonb not null default '{"type":"always"}',
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (tenant_id, id),
  unique (course_id, id),
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade,
  foreign key (course_id, parent_id) references public.course_sections(course_id, id) on delete cascade
);
create index course_sections_tree_idx on public.course_sections (course_id, parent_id, position);

-- unlock_rule shapes (validated in app with zod, documented in 06-functional-modules.md):
--   {"type":"always"}
--   {"type":"date","at":"2026-12-01T00:00:00Z"}
--   {"type":"relative","days_after_enrollment":7}
--   {"type":"after","lesson_ids":["…"],"min_score_pct":60}
--   {"type":"batch_release"}                     -- released per batch via batch_content_releases
-- completion_rule shapes:
--   {"type":"auto"}  {"type":"view"}  {"type":"watch_pct","pct":90}
--   {"type":"pass_test"}  {"type":"submit_assignment"}  {"type":"manual"}
create table public.lessons (
  id               uuid primary key default private.uuid7(),
  tenant_id        uuid not null,
  course_id        uuid not null,
  section_id       uuid not null,
  type             text not null check (type in ('video', 'live', 'pdf', 'document', 'image', 'audio', 'article',
                                                  'quiz', 'test', 'assignment', 'external_link', 'embed', 'scorm', 'lab', 'download')),
  title            text not null,
  summary          text,
  body             jsonb,                   -- article content / instructions
  media_asset_id   uuid,
  test_id          uuid,                    -- FK added in 50_assessments.sql
  assignment_id    uuid,                    -- FK added in 50_assessments.sql
  external_url     text,
  embed            jsonb,                   -- {"provider":"youtube","id":"…"} / lab provider config
  duration_seconds int check (duration_seconds >= 0),
  position         int not null default 0,
  is_preview       boolean not null default false,   -- free preview for non-enrolled visitors
  is_mandatory     boolean not null default true,    -- counts toward progress %
  completion_rule  jsonb not null default '{"type":"auto"}',
  unlock_rule      jsonb not null default '{"type":"always"}',
  xp_points        int not null default 0 check (xp_points >= 0),
  settings         jsonb not null default '{}',      -- {"allow_download":false,"watermark":true,"playback_speeds":[1,1.5,2]}
  is_published     boolean not null default false,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (tenant_id, id),
  unique (course_id, id),
  foreign key (tenant_id, course_id)      references public.courses(tenant_id, id) on delete cascade,
  foreign key (course_id, section_id)     references public.course_sections(course_id, id) on delete cascade,
  foreign key (tenant_id, media_asset_id) references public.media_assets(tenant_id, id) on delete set null (media_asset_id)
);
create index lessons_section_idx on public.lessons (section_id, position) where deleted_at is null;
create index lessons_course_idx  on public.lessons (course_id) where deleted_at is null and is_published;

create table public.lesson_resources (
  id             uuid primary key default private.uuid7(),
  tenant_id      uuid not null,
  lesson_id      uuid not null,
  media_asset_id uuid not null,
  title          text not null,
  allow_download boolean not null default false,
  position       int not null default 0,
  foreign key (tenant_id, lesson_id)      references public.lessons(tenant_id, id) on delete cascade,
  foreign key (tenant_id, media_asset_id) references public.media_assets(tenant_id, id) on delete cascade
);
create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id, position);

-- ------------------------------------------------------------------ batches
-- A batch/cohort is a scheduled run with its own students, faculty, timetable and
-- syllabus plan. One batch may cover several courses (NEET batch = Phy + Chem + Bio).
create table public.batches (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  branch_id  uuid,
  code       text not null,
  name       text not null,
  mode       text not null default 'online' check (mode in ('online', 'offline', 'hybrid')),
  status     text not null default 'upcoming' check (status in ('upcoming', 'enrolling', 'ongoing', 'completed', 'cancelled')),
  start_date date,
  end_date   date,
  capacity   int check (capacity > 0),
  timezone   text,
  schedule   jsonb not null default '{}',   -- {"rrule":"FREQ=WEEKLY;BYDAY=MO,WE,FR","time":"19:00","duration_min":90}
  settings   jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  check (end_date is null or start_date is null or end_date >= start_date),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete set null (branch_id)
);
create index batches_status_idx on public.batches (tenant_id, status, start_date);

create table public.batch_courses (
  tenant_id uuid not null,
  batch_id  uuid not null,
  course_id uuid not null,
  primary key (batch_id, course_id),
  foreign key (tenant_id, batch_id)  references public.batches(tenant_id, id) on delete cascade,
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade
);
create index batch_courses_course_idx on public.batch_courses (course_id);

create table public.batch_instructors (
  id        uuid primary key default private.uuid7(),
  tenant_id uuid not null,
  batch_id  uuid not null,
  member_id uuid not null,
  course_id uuid,                     -- subject this faculty teaches in the batch
  role      text not null default 'instructor' check (role in ('lead', 'instructor', 'assistant', 'mentor')),
  unique nulls not distinct (batch_id, member_id, course_id),
  foreign key (tenant_id, batch_id)  references public.batches(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade
);
create index batch_instructors_member_idx on public.batch_instructors (member_id);

-- Manual drip: instructor releases a section/lesson to one batch.
create table public.batch_content_releases (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null,
  batch_id    uuid not null,
  section_id  uuid,
  lesson_id   uuid,
  release_at  timestamptz not null default now(),
  released_by uuid,
  check (num_nonnulls(section_id, lesson_id) = 1),
  foreign key (tenant_id, batch_id)   references public.batches(tenant_id, id) on delete cascade,
  foreign key (tenant_id, section_id) references public.course_sections(tenant_id, id) on delete cascade,
  foreign key (tenant_id, lesson_id)  references public.lessons(tenant_id, id) on delete cascade
);
create index batch_content_releases_idx on public.batch_content_releases (batch_id, release_at);

-- -------------------------------------------------------------- live classes
create table public.live_sessions (
  id                  uuid primary key default private.uuid7(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  batch_id            uuid,
  course_id           uuid,
  lesson_id           uuid,
  host_member_id      uuid,
  title               text not null,
  description         text,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  provider            text not null default 'custom'
                      check (provider in ('zoom', 'google_meet', 'ms_teams', 'hms', 'jitsi', 'youtube_live', 'custom', 'in_person')),
  join_url            text,                 -- attendee link (hosts' links live in live_session_hosts)
  external_meeting_id text,
  location            jsonb,                -- in-person: branch/room
  status              text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  recording_media_id  uuid,
  series_id           uuid,                 -- groups occurrences generated from a recurring schedule
  attendance_mode     text not null default 'auto' check (attendance_mode in ('auto', 'manual', 'qr')),
  capacity            int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, id),
  check (ends_at > starts_at),
  foreign key (tenant_id, batch_id)           references public.batches(tenant_id, id) on delete cascade,
  foreign key (tenant_id, course_id)          references public.courses(tenant_id, id) on delete set null (course_id),
  foreign key (tenant_id, lesson_id)          references public.lessons(tenant_id, id) on delete set null (lesson_id),
  foreign key (tenant_id, host_member_id)     references public.tenant_members(tenant_id, id) on delete set null (host_member_id),
  foreign key (tenant_id, recording_media_id) references public.media_assets(tenant_id, id) on delete set null (recording_media_id)
);
create index live_sessions_time_idx  on public.live_sessions (tenant_id, starts_at);
create index live_sessions_batch_idx on public.live_sessions (batch_id, starts_at);
create index live_sessions_host_idx  on public.live_sessions (host_member_id, starts_at);

-- Host secrets kept apart so learners can never read them (staff/service only).
create table public.live_session_hosts (
  session_id uuid primary key,
  tenant_id  uuid not null,
  host_url   text,
  host_key   text,
  provider_payload jsonb not null default '{}',
  foreign key (tenant_id, session_id) references public.live_sessions(tenant_id, id) on delete cascade
);

create table public.attendance_records (
  tenant_id        uuid not null,
  live_session_id  uuid not null,
  member_id        uuid not null,
  status           text not null check (status in ('present', 'absent', 'late', 'excused')),
  joined_at        timestamptz,
  left_at          timestamptz,
  duration_seconds int,
  source           text not null default 'auto' check (source in ('auto', 'manual', 'qr', 'import', 'biometric')),
  marked_by        uuid,
  note             text,
  updated_at       timestamptz not null default now(),
  primary key (live_session_id, member_id),
  foreign key (tenant_id, live_session_id) references public.live_sessions(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id)       references public.tenant_members(tenant_id, id) on delete cascade
);
create index attendance_member_idx on public.attendance_records (tenant_id, member_id);

-- ------------------------------------------------- instructor syllabus tracking
-- "In Month 1 faculty will cover X, Y, Z" → planned items with target dates.
-- Faculty log coverage (optionally linked to the live session where it happened).
-- Views in 90_functions.sql compare plan vs actual per batch & per instructor.
create table public.syllabus_plans (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null,
  batch_id   uuid not null,
  course_id  uuid not null,
  title      text not null,
  status     text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, batch_id)  references public.batches(tenant_id, id) on delete cascade,
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade
);
create unique index syllabus_plans_one_active_uk on public.syllabus_plans (batch_id, course_id) where status = 'active';

create table public.syllabus_items (
  id              uuid primary key default private.uuid7(),
  tenant_id       uuid not null,
  plan_id         uuid not null,
  section_id      uuid,
  lesson_id       uuid,
  title           text not null,
  phase_label     text,                    -- 'Month 1', 'Phase 2', 'Week 5'
  planned_start   date,
  planned_end     date,
  owner_member_id uuid,                    -- responsible faculty
  weight          numeric(6,2) not null default 1 check (weight > 0),
  position        int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id),
  check (planned_end is null or planned_start is null or planned_end >= planned_start),
  foreign key (tenant_id, plan_id)         references public.syllabus_plans(tenant_id, id) on delete cascade,
  foreign key (tenant_id, section_id)      references public.course_sections(tenant_id, id) on delete set null (section_id),
  foreign key (tenant_id, lesson_id)       references public.lessons(tenant_id, id) on delete set null (lesson_id),
  foreign key (tenant_id, owner_member_id) references public.tenant_members(tenant_id, id) on delete set null (owner_member_id)
);
create index syllabus_items_plan_idx  on public.syllabus_items (plan_id, position);
create index syllabus_items_owner_idx on public.syllabus_items (owner_member_id, planned_end);

create table public.syllabus_coverage (
  id              uuid primary key default private.uuid7(),
  tenant_id       uuid not null,
  item_id         uuid not null,
  live_session_id uuid,
  covered_on      date not null default current_date,
  coverage_pct    smallint not null check (coverage_pct between 1 and 100),   -- cumulative % after this entry
  covered_by      uuid,
  notes           text,
  created_at      timestamptz not null default now(),
  foreign key (tenant_id, item_id)         references public.syllabus_items(tenant_id, id) on delete cascade,
  foreign key (tenant_id, live_session_id) references public.live_sessions(tenant_id, id) on delete set null (live_session_id)
);
create index syllabus_coverage_item_idx on public.syllabus_coverage (item_id, covered_on desc);

-- =============================================================================
-- 40_learning.sql  —  schema: public
-- Enrollment (access), progress tracking, notes, daily activity (streaks &
-- heatmaps), the activity event stream (analytics/badges), certificates.
-- =============================================================================

-- An enrollment = the right to access one course (optionally inside a batch).
-- Created by: purchase, admin, bundle, subscription, free signup, import, coupon.
create table public.enrollments (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null,
  member_id          uuid not null,
  course_id          uuid not null,
  batch_id           uuid,
  source             text not null check (source in ('purchase', 'admin', 'bundle', 'subscription', 'free', 'import', 'coupon', 'trial')),
  order_item_id      uuid,                 -- FK added in 70_commerce.sql
  status             text not null default 'active' check (status in ('active', 'paused', 'completed', 'expired', 'cancelled', 'refunded')),
  started_at         timestamptz not null default now(),   -- "days since enrollment" = now() - started_at
  expires_at         timestamptz,                          -- from course.access_duration_days / product
  completed_at       timestamptz,
  progress_pct       numeric(5,2) not null default 0 check (progress_pct between 0 and 100),
  lessons_completed  int not null default 0,
  lessons_total      int not null default 0,
  total_time_seconds bigint not null default 0,
  last_lesson_id     uuid,
  last_activity_at   timestamptz,
  certificate_id     uuid,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete restrict,
  foreign key (tenant_id, batch_id)  references public.batches(tenant_id, id) on delete set null (batch_id)
);
create unique index enrollments_one_live_uk on public.enrollments (tenant_id, member_id, course_id) where status in ('active', 'paused');
create index enrollments_member_idx on public.enrollments (member_id, status);
create index enrollments_course_idx on public.enrollments (tenant_id, course_id, status);
create index enrollments_batch_idx  on public.enrollments (batch_id) where batch_id is not null;
create index enrollments_expiry_idx on public.enrollments (expires_at) where status = 'active' and expires_at is not null;

-- One row per (enrollment, lesson). Written ONLY by public.record_lesson_progress()
-- and grading functions – never directly by clients.
create table public.lesson_progress (
  tenant_id             uuid not null,
  enrollment_id         uuid not null,
  lesson_id             uuid not null,
  member_id             uuid not null,
  course_id             uuid not null,
  status                text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  progress_pct          numeric(5,2) not null default 0 check (progress_pct between 0 and 100),
  last_position_seconds int not null default 0,
  time_spent_seconds    int not null default 0,
  view_count            int not null default 1,
  first_viewed_at       timestamptz not null default now(),
  last_viewed_at        timestamptz not null default now(),
  completed_at          timestamptz,
  primary key (enrollment_id, lesson_id),
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete cascade,
  foreign key (tenant_id, lesson_id)     references public.lessons(tenant_id, id) on delete cascade
);
create index lesson_progress_member_idx on public.lesson_progress (tenant_id, member_id, last_viewed_at desc);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id, status);

-- Learner's own notes & bookmarks (timestamped for videos, page for PDFs).
create table public.lesson_notes (
  id               uuid primary key default private.uuid7(),
  tenant_id        uuid not null,
  member_id        uuid not null,
  lesson_id        uuid not null,
  kind             text not null default 'note' check (kind in ('note', 'bookmark', 'highlight')),
  position_seconds int,
  page_no          int,
  body             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, lesson_id) references public.lessons(tenant_id, id) on delete cascade
);
create index lesson_notes_member_idx on public.lesson_notes (member_id, lesson_id);

-- Daily rollup per learner → streaks, activity heatmap, "active days" metric.
create table public.daily_activity (
  tenant_id         uuid not null,
  member_id         uuid not null,
  day               date not null,        -- in the tenant's timezone
  active_seconds    int not null default 0,
  lessons_completed int not null default 0,
  tests_submitted   int not null default 0,
  xp_earned         int not null default 0,
  primary key (tenant_id, member_id, day),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);

-- Append-only activity stream (xAPI-like). Feeds analytics, badge rules, audit
-- of learning. Partitioned monthly; old partitions detached → cold storage.
create table public.learning_events (
  id          uuid not null default private.uuid7(),
  tenant_id   uuid not null,
  member_id   uuid,
  verb        text not null,          -- 'lesson.started','lesson.completed','video.heartbeat','test.submitted','login',…
  object_type text,
  object_id   uuid,
  context     jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  primary key (id, occurred_at)
) partition by range (occurred_at);
create index learning_events_member_idx on public.learning_events (tenant_id, member_id, occurred_at desc);
create index learning_events_verb_idx   on public.learning_events (tenant_id, verb, occurred_at desc);
create table public.learning_events_default partition of public.learning_events default;
select private.ensure_monthly_partitions('public.learning_events', 3);

-- ---------------------------------------------------------------- certificates
create table public.certificate_templates (
  id              uuid primary key default private.uuid7(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  layout          jsonb not null default '{}',   -- positioned fields: name, course, date, serial, signatures, QR
  background_path text,
  orientation     text not null default 'landscape' check (orientation in ('landscape', 'portrait')),
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id)
);

create table public.certificates (
  id                uuid primary key default private.uuid7(),
  tenant_id         uuid not null,
  template_id       uuid,
  member_id         uuid not null,
  course_id         uuid,
  enrollment_id     uuid,
  serial_no         text not null,
  verification_code text not null unique,     -- public verify URL: /verify/{code}
  recipient_name    text not null,            -- snapshot at issue time
  title             text not null,
  data              jsonb not null default '{}',
  pdf_path          text,
  issued_at         timestamptz not null default now(),
  revoked_at        timestamptz,
  revoke_reason     text,
  unique (tenant_id, id),
  unique (tenant_id, serial_no),
  foreign key (tenant_id, template_id)   references public.certificate_templates(tenant_id, id) on delete set null (template_id),
  foreign key (tenant_id, member_id)     references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, course_id)     references public.courses(tenant_id, id) on delete set null (course_id),
  foreign key (tenant_id, enrollment_id) references public.enrollments(tenant_id, id) on delete set null (enrollment_id)
);
create index certificates_member_idx on public.certificates (member_id);

alter table public.enrollments
  add constraint enrollments_certificate_fk foreign key (tenant_id, certificate_id)
  references public.certificates(tenant_id, id) on delete set null (certificate_id);

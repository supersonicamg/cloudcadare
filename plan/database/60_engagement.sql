-- =============================================================================
-- 60_engagement.sql  —  schema: public
-- Gamification (XP, levels, badges, streaks, leaderboards), discussions &
-- doubt solving, reviews, announcements.
-- =============================================================================

-- Append-only XP ledger. member_stats.xp_total is derived from it (trigger).
-- idempotency_key makes awards safe to retry ("lesson:<id>", "test:<attempt>").
create table public.xp_ledger (
  id              uuid primary key default private.uuid7(),
  tenant_id       uuid not null,
  member_id       uuid not null,
  points          int not null check (points <> 0),
  reason          text not null,           -- 'lesson.completed','test.passed','streak.7','manual'
  source_type     text,
  source_id       uuid,
  idempotency_key text not null,
  awarded_by      uuid,                     -- staff for manual awards
  occurred_at     timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);
create index xp_ledger_member_idx on public.xp_ledger (tenant_id, member_id, occurred_at desc);
create index xp_ledger_period_idx on public.xp_ledger (tenant_id, occurred_at, member_id);

create table public.levels (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  level_no   int not null check (level_no > 0),
  name       text not null,              -- 'Cloud Explorer', 'Architect', 'Topper'
  min_xp     int not null check (min_xp >= 0),
  icon_path  text,
  perks      jsonb not null default '{}',
  unique (tenant_id, id),
  unique (tenant_id, level_no),
  unique (tenant_id, min_xp)
);

-- Denormalized per-learner scoreboard (one row per member; cheap reads for dashboards).
create table public.member_stats (
  tenant_id         uuid not null,
  member_id         uuid primary key,
  xp_total          int not null default 0,
  level_id          uuid,
  current_streak    int not null default 0,
  longest_streak    int not null default 0,
  last_active_day   date,
  badges_count      int not null default 0,
  lessons_completed int not null default 0,
  tests_taken       int not null default 0,
  avg_test_pct      numeric(5,2),
  updated_at        timestamptz not null default now(),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, level_id)  references public.levels(tenant_id, id) on delete set null (level_id)
);
create index member_stats_xp_idx on public.member_stats (tenant_id, xp_total desc);

-- Badge criteria are declarative rules evaluated by the rules worker on events:
--   {"event":"lesson.completed","count":10}
--   {"event":"test.graded","where":{"percentage_gte":90},"count":1,"scope":{"course_id":"…"}}
--   {"metric":"current_streak","gte":30}
--   {"event":"course.completed","scope":{"course_id":"…"}}
create table public.badges (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null,
  name        text not null,
  description text,
  icon_path   text,
  tier        text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum', 'special')),
  criteria    jsonb,                        -- NULL = manual-only badge
  xp_reward   int not null default 0,
  is_secret   boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key)
);

create table public.member_badges (
  tenant_id  uuid not null,
  badge_id   uuid not null,
  member_id  uuid not null,
  awarded_at timestamptz not null default now(),
  awarded_by uuid,                          -- NULL = automatic
  context    jsonb not null default '{}',
  primary key (badge_id, member_id),
  foreign key (tenant_id, badge_id)  references public.badges(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);
create index member_badges_member_idx on public.member_badges (member_id, awarded_at desc);

create table public.leaderboards (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  key        text not null,
  name       text not null,
  scope_type text not null default 'tenant' check (scope_type in ('tenant', 'course', 'batch', 'branch', 'test')),
  scope_id   uuid,
  metric     text not null default 'xp' check (metric in ('xp', 'test_score', 'streak', 'lessons_completed', 'attendance_pct')),
  period     text not null default 'weekly' check (period in ('daily', 'weekly', 'monthly', 'all_time')),
  top_n      int not null default 50 check (top_n between 3 and 1000),
  is_public  boolean not null default true,  -- visible to learners
  anonymize  boolean not null default false, -- show "Learner #12" (privacy for minors)
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key),
  check ((scope_type = 'tenant') = (scope_id is null))
);

-- Snapshot computed by pg_cron/worker (every 5–15 min). Reads never aggregate the ledger.
create table public.leaderboard_entries (
  tenant_id      uuid not null,
  leaderboard_id uuid not null,
  period_key     text not null,            -- '2026-W48', '2026-11', '2026-11-23', 'all'
  member_id      uuid not null,
  rank           int not null,
  score          numeric(12,2) not null,
  display_name   text,                     -- snapshot (respects anonymize)
  computed_at    timestamptz not null default now(),
  primary key (leaderboard_id, period_key, member_id),
  foreign key (tenant_id, leaderboard_id) references public.leaderboards(tenant_id, id) on delete cascade
);
create index leaderboard_entries_rank_idx on public.leaderboard_entries (leaderboard_id, period_key, rank);

-- ------------------------------------------------------- discussions & doubts
create table public.discussion_threads (
  id               uuid primary key default private.uuid7(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  kind             text not null default 'discussion' check (kind in ('discussion', 'doubt', 'announcement_comment')),
  context_type     text not null check (context_type in ('general', 'course', 'lesson', 'batch', 'test', 'question')),
  context_id       uuid,
  author_member_id uuid not null,
  title            text not null,
  body             jsonb not null,
  attachments      uuid[] not null default '{}',
  status           text not null default 'open' check (status in ('open', 'answered', 'resolved', 'closed', 'hidden')),
  assigned_to      uuid,                    -- doubt routed to a faculty member
  is_pinned        boolean not null default false,
  upvotes          int not null default 0,
  replies_count    int not null default 0,
  last_activity_at timestamptz not null default now(),
  sla_due_at       timestamptz,             -- doubt response SLA
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, author_member_id) references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, assigned_to)      references public.tenant_members(tenant_id, id) on delete set null (assigned_to)
);
create index discussion_threads_context_idx on public.discussion_threads (tenant_id, context_type, context_id, last_activity_at desc);
create index discussion_threads_queue_idx   on public.discussion_threads (tenant_id, kind, status, assigned_to) where status in ('open', 'answered');

create table public.discussion_posts (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null,
  thread_id          uuid not null,
  parent_id          uuid,
  author_member_id   uuid not null,
  body               jsonb not null,
  attachments        uuid[] not null default '{}',
  is_accepted_answer boolean not null default false,
  is_staff_answer    boolean not null default false,
  upvotes            int not null default 0,
  status             text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, thread_id)        references public.discussion_threads(tenant_id, id) on delete cascade,
  foreign key (tenant_id, parent_id)        references public.discussion_posts(tenant_id, id) on delete cascade,
  foreign key (tenant_id, author_member_id) references public.tenant_members(tenant_id, id) on delete cascade
);
create index discussion_posts_thread_idx on public.discussion_posts (thread_id, created_at);

create table public.votes (
  tenant_id   uuid not null,
  target_type text not null check (target_type in ('thread', 'post', 'review')),
  target_id   uuid not null,
  member_id   uuid not null,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (target_type, target_id, member_id),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);

create table public.content_reports (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  target_type text not null,
  target_id   uuid not null,
  reporter_id uuid not null,
  reason      text not null,
  status      text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolved_by uuid,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.reviews (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null,
  course_id  uuid not null,
  member_id  uuid not null,
  rating     smallint not null check (rating between 1 and 5),
  title      text,
  body       text,
  status     text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  reply      jsonb,                         -- academy's public reply
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, member_id),
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);
create index reviews_course_idx on public.reviews (course_id, status, created_at desc);

create table public.announcements (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  audience   jsonb not null default '{"type":"all"}',  -- all | roles:[…] | batches:[…] | courses:[…] | members:[…]
  title      text not null,
  body       jsonb not null,
  channels   text[] not null default '{in_app}' check (channels <@ '{in_app,email,sms,whatsapp,push}'),
  is_pinned  boolean not null default false,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_feed_idx on public.announcements (tenant_id, publish_at desc);

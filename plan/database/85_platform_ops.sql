-- =============================================================================
-- 85_platform_ops.sql  —  schema: public
-- Audit trail, transactional outbox, tenant API keys & outbound webhooks,
-- third-party integrations, bulk import jobs.
-- =============================================================================

-- Who did what, inside a tenant. Partitioned monthly; retained per plan (e.g. 1–7 yrs).
create table public.audit_logs (
  id               uuid not null default private.uuid7(),
  tenant_id        uuid not null,
  actor_user_id    uuid,
  actor_member_id  uuid,
  impersonated_by  uuid,                  -- platform/distributor staff using "login as"
  action           text not null,         -- 'course.published','member.role_granted','payment.offline_recorded'
  entity_type      text,
  entity_id        uuid,
  changes          jsonb,                 -- {"field":[old,new]} – never secrets
  ip               inet,
  user_agent       text,
  occurred_at      timestamptz not null default now(),
  primary key (id, occurred_at)
) partition by range (occurred_at);
create index audit_logs_tenant_idx on public.audit_logs (tenant_id, occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (tenant_id, entity_type, entity_id);
create table public.audit_logs_default partition of public.audit_logs default;
select private.ensure_monthly_partitions('public.audit_logs', 3);

-- Transactional outbox: domain events are inserted in the SAME transaction as
-- the state change, then a worker publishes them (notifications, badges, XP,
-- webhooks, search indexing, analytics). Guarantees no lost/phantom events.
create table public.outbox_events (
  id             uuid primary key default private.uuid7(),
  tenant_id      uuid not null,
  event_type     text not null,           -- see plan/10-api-events-jobs.md event catalog
  aggregate_type text,
  aggregate_id   uuid,
  payload        jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  available_at   timestamptz not null default now(),
  published_at   timestamptz,
  attempts       int not null default 0,
  last_error     text
);
create index outbox_events_pending_idx on public.outbox_events (available_at) where published_at is null;

create table public.api_keys (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,             -- shown in UI: 'sk_live_3fA9…'
  key_hash     bytea not null unique,     -- SHA-256 of the secret
  scopes       text[] not null default '{}',
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

create table public.webhook_endpoints (
  id              uuid primary key default private.uuid7(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  url             text not null check (url ~ '^https://'),
  description     text,
  events          text[] not null default '{}',
  secret_vault_id uuid,
  is_active       boolean not null default true,
  failure_count   int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id)
);

create table public.webhook_deliveries (
  id            uuid primary key default private.uuid7(),
  tenant_id     uuid not null,
  endpoint_id   uuid not null,
  event_id      uuid not null,
  status        text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'dead')),
  response_code int,
  attempts      int not null default 0,
  next_retry_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (tenant_id, endpoint_id) references public.webhook_endpoints(tenant_id, id) on delete cascade
);
create index webhook_deliveries_retry_idx on public.webhook_deliveries (next_retry_at) where status in ('pending', 'failed');

-- Tenant-level provider connections (Zoom, Google, Mux, MSG91, WhatsApp, SMTP…).
create table public.integrations (
  id              uuid primary key default private.uuid7(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  provider        text not null,
  config          jsonb not null default '{}',   -- non-secret settings
  secret_vault_id uuid,
  status          text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  last_error      text,
  connected_by    uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, provider)
);

create table public.import_jobs (
  id                uuid primary key default private.uuid7(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  entity            text not null check (entity in ('members', 'enrollments', 'questions', 'leads', 'attendance', 'offline_payments')),
  file_path         text not null,
  mapping           jsonb not null default '{}',
  status            text not null default 'queued' check (status in ('queued', 'validating', 'running', 'completed', 'failed', 'cancelled')),
  total_rows        int,
  success_rows      int not null default 0,
  error_rows        int not null default 0,
  error_report_path text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  finished_at       timestamptz
);

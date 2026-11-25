-- =============================================================================
-- 10_control_plane.sql  —  schema: control
-- The distributor layer. Source of truth for WHO a tenant is, WHAT they bought,
-- WHICH features are on, WHERE their data lives and WHICH frontend serves them.
-- Data planes receive a projection of this (public.tenants, public.tenant_entitlements).
-- =============================================================================

-- ------------------------------------------------------------ platform settings
-- Key/value for platform-wide config: base_domain, support email, default plane…
create table control.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- distributors
-- Tree: exactly one 'platform' root (you). Resellers/partners hang below it and
-- may (if allowed) create sub-distributors. Every tenant belongs to one node;
-- a distributor sees its own subtree only (control.distributor_subtree()).
create table control.distributors (
  id                          uuid primary key default private.uuid7(),
  parent_id                   uuid references control.distributors(id) on delete restrict,
  kind                        text not null default 'reseller'
                              check (kind in ('platform', 'reseller', 'partner')),
  name                        text not null,
  slug                        extensions.citext not null unique,
  legal_name                  text,
  gstin                       text,
  pan                         text,
  contact_email               extensions.citext,
  contact_phone               text,
  billing_address             jsonb not null default '{}',
  console_branding            jsonb not null default '{}',   -- white-label the console for resellers
  revenue_share_pct           numeric(5,2) not null default 0 check (revenue_share_pct between 0 and 100),
  max_tenants                 int check (max_tenants > 0),
  can_create_plans            boolean not null default false,
  can_create_sub_distributors boolean not null default false,
  status                      text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (kind <> 'platform' or parent_id is null),
  check (parent_id is null or parent_id <> id)
);
create unique index distributors_single_platform_uk on control.distributors ((true)) where kind = 'platform';
create index distributors_parent_idx on control.distributors (parent_id);

create table control.distributor_members (
  id             uuid primary key default private.uuid7(),
  distributor_id uuid not null references control.distributors(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           text not null check (role in ('owner', 'admin', 'sales', 'support', 'finance', 'viewer')),
  status         text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (distributor_id, user_id)
);
create index distributor_members_user_idx on control.distributor_members (user_id) where status = 'active';

-- ------------------------------------------------------------------- features
-- The catalog of every toggleable capability. Keys are stable code identifiers
-- (packages/features/catalog.ts is generated from this table).
create table control.features (
  key               text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),
  module            text not null,
  name              text not null,
  description       text,
  kind              text not null default 'boolean' check (kind in ('boolean', 'limit', 'config')),
  is_core           boolean not null default false,   -- always on; cannot be sold or disabled
  default_enabled   boolean not null default false,   -- used when no plan/addon/override mentions it
  default_limit     bigint,                           -- for kind='limit'; NULL = unlimited
  unit              text,                             -- 'members', 'gb', 'hours', 'messages' …
  depends_on        text[] not null default '{}',     -- disabled automatically if a dependency is off
  config_schema     jsonb,                            -- JSON Schema validating plan/override config
  tenant_can_toggle boolean not null default true,    -- tenant admin may switch an entitled module off
  lifecycle         text not null default 'ga' check (lifecycle in ('alpha', 'beta', 'ga', 'deprecated')),
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------- templates (vertical & frontend)
-- Vertical = industry preset applied at provisioning (terminology, default
-- modules, exam patterns, seed levels/badges). Lets the same core serve
-- cloud academies, NEET/JEE coaching, UPSC, K-12 tuition, skill institutes…
create table control.vertical_templates (
  key              text primary key,
  name             text not null,
  description      text,
  terminology      jsonb not null default '{}',   -- {"course":"Course","batch":"Batch","instructor":"Faculty",…}
  disabled_modules text[] not null default '{}',  -- entitled modules that start switched OFF for this vertical (admin can enable)
  default_settings jsonb not null default '{}',   -- merged into public.tenant_settings
  seed             jsonb not null default '{}',   -- {"levels":[…],"badges":[…],"taxonomy":[…]}
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Frontend = which UI serves the tenant. 'theme' = a theme package rendered by the
-- shared academy app. 'custom_app' = a separate Next.js app (zone) built for one
-- client on top of the same core packages (see plan/05-frontend-customization.md).
create table control.frontend_templates (
  key                text primary key check (key ~ '^[a-z0-9:_-]+$'),
  name               text not null,
  kind               text not null check (kind in ('theme', 'custom_app')),
  package_name       text,                     -- e.g. '@themes/aurora' or '@apps/client-cloudcadre'
  deployment_url     text,                     -- custom_app: origin the edge router forwards to
  supported_features text[] not null default '{}',
  settings_schema    jsonb,                    -- JSON Schema for theme-specific settings
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (kind <> 'custom_app' or deployment_url is not null)
);

-- ----------------------------------------------------------------- data planes
-- Where a tenant's data physically lives. 'pooled' = shared Supabase project
-- (RLS isolation). 'dedicated' = a Supabase project for one tenant (silo).
-- Same migrations run on every plane.
create table control.data_planes (
  id                   uuid primary key default private.uuid7(),
  name                 text not null unique,
  mode                 text not null check (mode in ('pooled', 'dedicated')),
  supabase_project_ref text,
  api_url              text,
  region               text not null default 'ap-south-1',
  secret_ref           text,          -- name of the Vault secret / env var holding the secret key. Never the key itself.
  schema_version       text,          -- last migration applied (reported by CI)
  max_tenants          int,
  status               text not null default 'active' check (status in ('active', 'draining', 'maintenance', 'retired')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ----------------------------------------------------------------------- plans
create table control.plans (
  id               uuid primary key default private.uuid7(),
  distributor_id   uuid not null references control.distributors(id) on delete restrict,
  code             text not null,
  name             text not null,
  description      text,
  tier             int not null default 0,
  billing_interval text not null default 'month' check (billing_interval in ('month', 'quarter', 'year', 'one_time', 'custom')),
  price_minor      bigint not null default 0 check (price_minor >= 0),
  setup_fee_minor  bigint not null default 0 check (setup_fee_minor >= 0),
  currency         char(3) not null default 'INR',
  trial_days       int not null default 0 check (trial_days >= 0),
  is_public        boolean not null default false,
  status           text not null default 'active' check (status in ('draft', 'active', 'retired')),
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (distributor_id, code)
);

create table control.plan_features (
  plan_id     uuid not null references control.plans(id) on delete cascade,
  feature_key text not null references control.features(key) on update cascade on delete cascade,
  enabled     boolean not null default true,
  limit_value bigint,                       -- NULL = unlimited (for kind='limit')
  config      jsonb not null default '{}',
  primary key (plan_id, feature_key)
);

-- Add-ons: sold on top of a plan ("+500 students", "WhatsApp pack", "DRM video").
create table control.addons (
  id               uuid primary key default private.uuid7(),
  distributor_id   uuid not null references control.distributors(id) on delete restrict,
  code             text not null,
  name             text not null,
  description      text,
  price_minor      bigint not null default 0 check (price_minor >= 0),
  currency         char(3) not null default 'INR',
  billing_interval text not null default 'month' check (billing_interval in ('month', 'quarter', 'year', 'one_time')),
  status           text not null default 'active' check (status in ('draft', 'active', 'retired')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (distributor_id, code)
);

create table control.addon_features (
  addon_id    uuid not null references control.addons(id) on delete cascade,
  feature_key text not null references control.features(key) on update cascade on delete cascade,
  enabled     boolean not null default true,
  limit_value bigint,
  limit_mode  text not null default 'add' check (limit_mode in ('add', 'set')),  -- add = per unit of quantity
  config      jsonb not null default '{}',
  primary key (addon_id, feature_key)
);

-- --------------------------------------------------------------------- tenants
create table control.tenants (
  id                    uuid primary key default private.uuid7(),
  distributor_id        uuid not null references control.distributors(id) on delete restrict,
  slug                  extensions.citext not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  name                  text not null,
  legal_name            text,
  gstin                 text,
  status                text not null default 'provisioning'
                        check (status in ('provisioning', 'trial', 'active', 'past_due', 'suspended', 'cancelled', 'archived')),
  vertical_key          text references control.vertical_templates(key),
  frontend_template_key text not null default 'default' references control.frontend_templates(key),
  deployment_mode       text not null default 'pooled' check (deployment_mode in ('pooled', 'dedicated')),
  data_plane_id         uuid not null references control.data_planes(id),
  owner_user_id         uuid references auth.users(id) on delete set null,
  license_key_id        uuid,               -- FK added below
  region                text not null default 'ap-south-1',
  timezone              text not null default 'Asia/Kolkata',
  default_locale        text not null default 'en-IN',
  currency              char(3) not null default 'INR',
  country               char(2) not null default 'IN',
  contact_email         extensions.citext,
  contact_phone         text,
  trial_ends_at         timestamptz,
  suspended_at          timestamptz,
  suspension_reason     text,
  cancelled_at          timestamptz,
  metadata              jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index tenants_distributor_idx on control.tenants (distributor_id, status);
create index tenants_data_plane_idx  on control.tenants (data_plane_id);

create table control.reserved_slugs (
  slug extensions.citext primary key
);

-- Every hostname that serves a tenant. The edge router (proxy.ts) resolves
-- Host → tenant via this table (cached in Redis/Edge Config, not queried per request).
create table control.tenant_domains (
  id                  uuid primary key default private.uuid7(),
  tenant_id           uuid not null references control.tenants(id) on delete cascade,
  hostname            extensions.citext not null unique check (hostname ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  kind                text not null check (kind in ('platform_subdomain', 'custom')),
  is_primary          boolean not null default false,
  deployment_target   text,                 -- overrides tenant.frontend_template_key for this host (e.g. staging)
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'failed')),
  verification_record jsonb,                -- TXT/CNAME instructions from the hosting provider
  ssl_status          text not null default 'pending' check (ssl_status in ('pending', 'issued', 'failed')),
  verified_at         timestamptz,
  last_checked_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index tenant_domains_one_primary_uk on control.tenant_domains (tenant_id) where is_primary;
create index tenant_domains_tenant_idx on control.tenant_domains (tenant_id);

-- ---------------------------------------------------------------- license keys
-- Distributor issues a key → customer redeems it to create their academy.
-- Only a SHA-256 hash is stored; the plaintext is shown once at creation.
create table control.license_keys (
  id                    uuid primary key default private.uuid7(),
  distributor_id        uuid not null references control.distributors(id) on delete restrict,
  plan_id               uuid not null references control.plans(id) on delete restrict,
  key_hash              bytea not null unique,
  key_hint              text not null,                 -- e.g. 'EDU-9F2A…7Q1M' for support lookups
  vertical_key          text references control.vertical_templates(key),
  frontend_template_key text references control.frontend_templates(key),
  deployment_mode       text not null default 'pooled' check (deployment_mode in ('pooled', 'dedicated')),
  addon_codes           text[] not null default '{}',
  feature_overrides     jsonb not null default '{}',   -- {"engage.leaderboards":{"enabled":true},"limit.members":{"limit_value":2000}}
  term_days             int check (term_days > 0),     -- subscription length granted on activation; NULL = open-ended
  max_activations       int not null default 1 check (max_activations > 0),
  activation_count      int not null default 0,
  expires_at            timestamptz,                   -- must be redeemed before this
  restricted_email      extensions.citext,             -- optionally bind a key to one customer
  status                text not null default 'active' check (status in ('active', 'revoked', 'exhausted', 'expired')),
  notes                 text,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (activation_count between 0 and max_activations)
);
create index license_keys_distributor_idx on control.license_keys (distributor_id, status);

alter table control.tenants
  add constraint tenants_license_key_fk foreign key (license_key_id) references control.license_keys(id) on delete set null;

create table control.license_activations (
  id             uuid primary key default private.uuid7(),
  license_key_id uuid not null references control.license_keys(id) on delete restrict,
  tenant_id      uuid not null references control.tenants(id) on delete cascade,
  activated_by   uuid references auth.users(id) on delete set null,
  ip             inet,
  user_agent     text,
  activated_at   timestamptz not null default now()
);

-- ------------------------------------------------- subscriptions & entitlements
create table control.tenant_subscriptions (
  id                       uuid primary key default private.uuid7(),
  tenant_id                uuid not null references control.tenants(id) on delete cascade,
  plan_id                  uuid not null references control.plans(id) on delete restrict,
  status                   text not null check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired')),
  billing_provider         text not null default 'manual' check (billing_provider in ('razorpay', 'stripe', 'manual', 'license')),
  external_subscription_id text,
  price_minor_override     bigint check (price_minor_override >= 0),
  currency                 char(3) not null default 'INR',
  started_at               timestamptz not null default now(),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at                timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create unique index tenant_subscriptions_one_live_uk on control.tenant_subscriptions (tenant_id)
  where status in ('trialing', 'active', 'past_due', 'paused');

create table control.tenant_addons (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null references control.tenants(id) on delete cascade,
  addon_id   uuid not null references control.addons(id) on delete restrict,
  quantity   int not null default 1 check (quantity > 0),
  status     text not null default 'active' check (status in ('active', 'cancelled')),
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tenant_addons_tenant_idx on control.tenant_addons (tenant_id) where status = 'active';

-- Manual per-tenant grants/revokes from the distributor console (beats plan & add-ons).
create table control.tenant_feature_overrides (
  tenant_id   uuid not null references control.tenants(id) on delete cascade,
  feature_key text not null references control.features(key) on update cascade on delete cascade,
  enabled     boolean,              -- NULL = don't override the boolean, only limit/config
  limit_value bigint,
  config      jsonb not null default '{}',
  reason      text,
  expires_at  timestamptz,
  set_by      uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

-- Materialized result of plan + add-ons + overrides + dependencies.
-- Recomputed by control.refresh_entitlements(); pushed to the tenant's data plane.
create table control.tenant_entitlements (
  tenant_id   uuid not null references control.tenants(id) on delete cascade,
  feature_key text not null references control.features(key) on update cascade on delete cascade,
  enabled     boolean not null,
  limit_value bigint,
  config      jsonb not null default '{}',
  source      text not null check (source in ('core', 'plan', 'addon', 'override', 'default', 'dependency')),
  computed_at timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

-- ----------------------------------------------------------- usage & billing
-- Aggregated per month. Data planes report usage (members, storage, video
-- minutes, SMS, AI tokens) via the sync worker.
create table control.usage_records (
  tenant_id    uuid not null references control.tenants(id) on delete cascade,
  metric       text not null,
  period_start date not null,
  quantity     bigint not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, metric, period_start)
);

create table control.platform_invoices (
  id                      uuid primary key default private.uuid7(),
  tenant_id               uuid not null references control.tenants(id) on delete restrict,
  distributor_id          uuid not null references control.distributors(id) on delete restrict,
  subscription_id         uuid references control.tenant_subscriptions(id) on delete set null,
  invoice_no              text not null unique,
  period_start            date,
  period_end              date,
  line_items              jsonb not null default '[]',
  subtotal_minor          bigint not null default 0,
  tax_minor               bigint not null default 0,
  total_minor             bigint not null default 0,
  distributor_share_minor bigint not null default 0,
  currency                char(3) not null default 'INR',
  status                  text not null default 'draft' check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  due_at                  timestamptz,
  paid_at                 timestamptz,
  pdf_path                text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index platform_invoices_tenant_idx on control.platform_invoices (tenant_id, created_at desc);

-- --------------------------------------------------------------- operations
-- "Login as" support access. Always time-boxed, reasoned and audited; the
-- academy can see these sessions in their own audit log.
create table control.impersonation_sessions (
  id               uuid primary key default private.uuid7(),
  actor_user_id    uuid not null references auth.users(id) on delete restrict,
  tenant_id        uuid not null references control.tenants(id) on delete cascade,
  target_member_id uuid,
  reason           text not null check (length(reason) >= 10),
  scope            text not null default 'read_only' check (scope in ('read_only', 'full')),
  started_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  ended_at         timestamptz,
  ip               inet,
  user_agent       text,
  check (expires_at > started_at and expires_at <= started_at + interval '4 hours')
);

create table control.provisioning_jobs (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null references control.tenants(id) on delete cascade,
  kind        text not null check (kind in ('provision', 'move_data_plane', 'suspend', 'resume', 'export', 'delete', 'sync')),
  status      text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  step        text,
  attempts    int not null default 0,
  payload     jsonb not null default '{}',
  last_error  text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index provisioning_jobs_status_idx on control.provisioning_jobs (status, created_at);

-- Events for the sync worker (entitlements changed, tenant suspended, domain verified…)
create table control.outbox_events (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid references control.tenants(id) on delete cascade,
  event_type   text not null,
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  attempts     int not null default 0,
  last_error   text
);
create index control_outbox_unpublished_idx on control.outbox_events (created_at) where published_at is null;

create table control.platform_announcements (
  id             uuid primary key default private.uuid7(),
  distributor_id uuid not null references control.distributors(id) on delete cascade,
  audience       jsonb not null default '{"type":"all"}',   -- all | plans:[…] | tenants:[…]
  title          text not null,
  body           text not null,
  severity       text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table control.audit_logs (
  id                   bigint generated always as identity primary key,
  occurred_at          timestamptz not null default now(),
  actor_user_id        uuid,
  actor_distributor_id uuid,
  tenant_id            uuid,
  action               text not null,                 -- 'tenant.suspended', 'feature.override.set' …
  target_type          text,
  target_id            text,
  before               jsonb,
  after                jsonb,
  ip                   inet,
  user_agent           text
);
create index control_audit_tenant_idx on control.audit_logs (tenant_id, occurred_at desc);
create index control_audit_actor_idx  on control.audit_logs (actor_user_id, occurred_at desc);

-- Control plane is server-only: RLS on with NO policies = deny for every API role.
-- The console's Data Access Layer (secret key) is the authorization boundary.
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'control' loop
    execute format('alter table control.%I enable row level security', r.tablename);
  end loop;
end $$;

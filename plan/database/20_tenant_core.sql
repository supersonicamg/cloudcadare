-- =============================================================================
-- 20_tenant_core.sql  —  schema: public (DATA PLANE)
-- Tenancy projection, configuration, branding, people, roles & permissions,
-- taxonomy, media library, compliance.
--
-- Conventions used in every data-plane table:
--   * tenant_id uuid NOT NULL on every row (yes, even in dedicated planes) so the
--     same code & migrations work pooled or siloed and tenants can be moved.
--   * Referenced tables expose UNIQUE (tenant_id, id); children use COMPOSITE
--     foreign keys (tenant_id, x_id) → a row can never point at another tenant's row.
--   * Enumerations are text + CHECK (cheap to evolve, unlike enum types).
--   * Money = bigint minor units (paise). Time = timestamptz (UTC).
--   * Soft delete (deleted_at) only on authored content; transactional rows are never deleted.
-- =============================================================================

-- ------------------------------------------------------------ tenancy mirror
-- Written ONLY by the control-plane sync worker (service role).
create table public.tenants (
  id                    uuid primary key,          -- same id as control.tenants.id
  slug                  extensions.citext not null unique,
  name                  text not null,
  status                text not null check (status in ('provisioning', 'trial', 'active', 'past_due', 'suspended', 'cancelled', 'archived')),
  vertical_key          text,
  frontend_template_key text not null default 'default',
  timezone              text not null default 'Asia/Kolkata',
  default_locale        text not null default 'en-IN',
  currency              char(3) not null default 'INR',
  country               char(2) not null default 'IN',
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- What the tenant PAID for (projection of control.tenant_entitlements).
create table public.tenant_entitlements (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null,
  enabled     boolean not null,
  limit_value bigint,
  config      jsonb not null default '{}',
  synced_at   timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

-- What the tenant admin CHOSE to switch on, within the entitlement.
-- effective = entitlement.enabled AND coalesce(tenant_modules.is_enabled, true)
create table public.tenant_modules (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null,
  is_enabled  boolean not null default true,
  config      jsonb not null default '{}',     -- tenant-level module settings (e.g. leaderboard period)
  updated_by  uuid,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

-- Public-facing identity. Safe to render on anonymous pages.
create table public.tenant_branding (
  tenant_id        uuid primary key references public.tenants(id) on delete cascade,
  display_name     text not null,
  tagline          text,
  logo_path        text,
  logo_dark_path   text,
  icon_path        text,
  favicon_path     text,
  og_image_path    text,
  theme_key        text not null default 'default',   -- theme package to render (see frontend_templates)
  tokens           jsonb not null default '{}',       -- design tokens → CSS variables (colors, radius, fonts, mode)
  theme_settings   jsonb not null default '{}',       -- validated by the theme's settings_schema
  contact          jsonb not null default '{}',       -- email, phone, whatsapp, address, map
  social           jsonb not null default '{}',
  footer           jsonb not null default '{}',
  seo              jsonb not null default '{}',       -- title template, description, keywords
  analytics        jsonb not null default '{}',       -- PUBLIC ids only (GA4, Meta pixel). No raw scripts.
  show_powered_by  boolean not null default true,     -- removable via feature site.remove_branding
  updated_at       timestamptz not null default now()
);

-- Private operational settings (never rendered to anonymous visitors).
create table public.tenant_settings (
  tenant_id     uuid primary key references public.tenants(id) on delete cascade,
  terminology   jsonb not null default '{}',   -- overrides vertical terminology ("Batch" → "Cohort")
  auth          jsonb not null default '{}',   -- {"methods":["phone_otp","email_otp","google"],"open_signup":true}
  learning      jsonb not null default '{}',   -- {"sequential":false,"completion_threshold_pct":90}
  assessment    jsonb not null default '{}',   -- {"default_negative_marking":0.25,"autosave_seconds":20}
  commerce      jsonb not null default '{}',   -- {"invoice_prefix":"CC","gst":{…},"refund_window_days":7}
  notifications jsonb not null default '{}',
  security      jsonb not null default '{}',   -- {"device_limit":2,"watermark":true,"admin_mfa":true}
  localization  jsonb not null default '{}',   -- {"locales":["en","hi"]}
  updated_at    timestamptz not null default now()
);

-- Per-tenant counters for human-readable numbers (order no, invoice no, roll no).
-- Avoids one sequence per tenant. See private.next_counter().
create table public.tenant_counters (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  counter_key text not null,
  value       bigint not null default 0,
  primary key (tenant_id, counter_key)
);

create table public.branches (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  code       text not null,
  name       text not null,
  address    jsonb not null default '{}',
  city       text,
  state      text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

-- ------------------------------------------------------------------- people
-- auth.users = one global login identity (email/phone).
-- tenant_members = that identity's profile INSIDE one academy. A person who
-- joins two academies has two member rows, two roll numbers, two progress
-- histories – and each academy only ever sees its own row.
create table public.tenant_members (
  id             uuid primary key default private.uuid7(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,  -- NULL after account erasure (row anonymized, finance kept)
  status         text not null default 'active' check (status in ('invited', 'active', 'suspended', 'left', 'erased')),
  display_name   text not null,
  email          extensions.citext,
  phone          text,
  avatar_path    text,
  member_code    text,                       -- roll / enrollment / employee number
  branch_id      uuid,
  date_of_birth  date,
  gender         text,
  is_minor       boolean not null default false,  -- drives DPDP verifiable-guardian-consent flow
  locale         text,
  custom_fields  jsonb not null default '{}',  -- validated against custom_field_definitions
  joined_at      timestamptz not null default now(),
  last_active_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, user_id),
  unique (tenant_id, member_code),
  foreign key (tenant_id, branch_id) references public.branches(tenant_id, id) on delete set null (branch_id)
);
create index tenant_members_user_idx   on public.tenant_members (user_id) where status = 'active';
create index tenant_members_email_idx  on public.tenant_members (tenant_id, email);
create index tenant_members_phone_idx  on public.tenant_members (tenant_id, phone);
create index tenant_members_name_trgm  on public.tenant_members using gin (display_name extensions.gin_trgm_ops);

-- Global permission catalog (identical on every plane, owned by code).
create table public.permission_catalog (
  key          text primary key check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  feature_key  text not null,          -- permission is only meaningful when this feature is on
  group_name   text not null,
  description  text not null,
  is_sensitive boolean not null default false   -- requires MFA (aal2) for staff holding it
);

create table public.roles (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  key         text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name        text not null,
  description text,
  kind        text not null default 'staff' check (kind in ('staff', 'learner', 'guardian')),
  is_system   boolean not null default false,   -- seeded; cannot be deleted (custom roles need org.custom_roles)
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key)
);

create table public.role_permissions (
  tenant_id      uuid not null,
  role_id        uuid not null,
  permission_key text not null references public.permission_catalog(key) on update cascade on delete cascade,
  primary key (role_id, permission_key),
  foreign key (tenant_id, role_id) references public.roles(tenant_id, id) on delete cascade
);
create index role_permissions_perm_idx on public.role_permissions (permission_key, role_id);

-- A role can be granted tenant-wide or limited to a branch / batch / course.
create table public.member_roles (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null,
  member_id  uuid not null,
  role_id    uuid not null,
  scope_type text not null default 'tenant' check (scope_type in ('tenant', 'branch', 'batch', 'course')),
  scope_id   uuid,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  check ((scope_type = 'tenant') = (scope_id is null)),
  unique nulls not distinct (member_id, role_id, scope_type, scope_id),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, role_id)   references public.roles(tenant_id, id) on delete cascade
);
create index member_roles_member_idx on public.member_roles (member_id);
create index member_roles_role_idx   on public.member_roles (role_id);

create table public.invitations (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       extensions.citext,
  phone       text,
  role_key    text not null,
  scope_type  text not null default 'tenant',
  scope_id    uuid,
  token_hash  bytea not null unique,
  invited_by  uuid,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index invitations_tenant_idx on public.invitations (tenant_id, created_at desc);

-- Parent / guardian ↔ student (feature org.parent_portal; also used for minors' consent).
create table public.guardian_links (
  tenant_id          uuid not null,
  guardian_member_id uuid not null,
  student_member_id  uuid not null,
  relation           text not null default 'parent' check (relation in ('parent', 'guardian', 'sponsor', 'other')),
  permissions        jsonb not null default '{"progress":true,"attendance":true,"results":true,"payments":true}',
  verified_at        timestamptz,
  created_at         timestamptz not null default now(),
  primary key (guardian_member_id, student_member_id),
  check (guardian_member_id <> student_member_id),
  foreign key (tenant_id, guardian_member_id) references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, student_member_id)  references public.tenant_members(tenant_id, id) on delete cascade
);
create index guardian_links_student_idx on public.guardian_links (student_member_id);

-- Public faculty profile (CMS "Our faculty" page, course pages).
create table public.instructor_profiles (
  tenant_id        uuid not null,
  member_id        uuid primary key,
  headline         text,
  bio              jsonb,
  expertise        text[] not null default '{}',
  experience_years smallint,
  credentials      jsonb not null default '[]',
  social           jsonb not null default '{}',
  is_public        boolean not null default true,
  sort_order       int not null default 0,
  updated_at       timestamptz not null default now(),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);

-- Tenant-defined extra fields (NEET: target year; UPSC: optional subject; cloud: company, years of experience).
create table public.custom_field_definitions (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  entity      text not null check (entity in ('member', 'course', 'enrollment', 'lead', 'order', 'batch')),
  key         text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label       text not null,
  field_type  text not null check (field_type in ('text', 'textarea', 'number', 'date', 'select', 'multiselect', 'boolean', 'file', 'phone', 'email', 'url')),
  options     jsonb not null default '[]',
  is_required boolean not null default false,
  visibility  text not null default 'staff' check (visibility in ('staff', 'self', 'public')),
  editable_by text not null default 'staff' check (editable_by in ('staff', 'self')),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, entity, key)
);

-- Concurrent device / session limit (anti account-sharing; security.device_limits).
create table public.member_devices (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null,
  member_id          uuid not null,
  device_fingerprint text not null,
  label              text,
  user_agent         text,
  ip                 inet,
  auth_session_id    uuid,                -- auth.sessions.id, so we can revoke it
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  revoked_at         timestamptz,
  unique (member_id, device_fingerprint),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);

-- ------------------------------------------------------------- compliance (DPDP Act 2023)
create table public.consents (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null,
  member_id          uuid not null,
  purpose            text not null,             -- 'terms', 'privacy', 'marketing_email', 'whatsapp', 'guardian_consent'
  policy_version     text not null,
  granted_at         timestamptz not null default now(),
  withdrawn_at       timestamptz,
  guardian_member_id uuid,                      -- consent given on behalf of a minor
  evidence           jsonb not null default '{}',  -- ip, ua, otp verification ref
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);
create index consents_member_idx on public.consents (member_id, purpose);

create table public.data_subject_requests (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  member_id    uuid,
  request_type text not null check (request_type in ('access', 'export', 'correction', 'erasure', 'grievance')),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'rejected')),
  details      text,
  resolution   text,
  due_at       timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -------------------------------------------------------------- taxonomy
-- One flexible tree for categories, exams, subjects, topics, skills, chapters.
-- (Cloud: "AWS › Compute › EC2"; NEET: "Biology › Botany › Cell"; UPSC: "GS-II › Polity")
create table public.taxonomy_terms (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  vocabulary  text not null check (vocabulary in ('category', 'exam', 'subject', 'topic', 'skill', 'chapter', 'tag')),
  parent_id   uuid,
  name        text not null,
  slug        extensions.citext not null,
  description text,
  icon_path   text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, vocabulary, slug),
  foreign key (tenant_id, parent_id) references public.taxonomy_terms(tenant_id, id) on delete cascade
);
create index taxonomy_terms_parent_idx on public.taxonomy_terms (tenant_id, vocabulary, parent_id);

-- --------------------------------------------------------------- media library
-- Provider-agnostic: documents/images live in Supabase Storage; videos in a
-- video platform (Mux / Bunny Stream / VdoCipher / Cloudflare Stream) for
-- transcoding, adaptive streaming and DRM.
create table public.media_assets (
  id               uuid primary key default private.uuid7(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  kind             text not null check (kind in ('video', 'audio', 'image', 'document', 'archive', 'scorm', 'other')),
  provider         text not null default 'supabase'
                   check (provider in ('supabase', 'mux', 'bunny', 'vdocipher', 'cloudflare_stream', 'youtube', 'vimeo', 'external_url')),
  title            text,
  storage_bucket   text,
  storage_path     text,
  external_id      text,              -- provider asset id
  playback_id      text,              -- provider playback id (never a signed URL – those are minted per request)
  mime_type        text,
  size_bytes       bigint check (size_bytes >= 0),
  duration_seconds int,
  page_count       int,
  width            int,
  height           int,
  checksum_sha256  text,
  status           text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'failed', 'deleted')),
  drm_enabled      boolean not null default false,
  captions         jsonb not null default '[]',
  metadata         jsonb not null default '{}',
  uploaded_by      uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (tenant_id, id),
  check (provider not in ('supabase') or (storage_bucket is not null and storage_path is not null))
);
create index media_assets_tenant_idx on public.media_assets (tenant_id, kind, created_at desc) where deleted_at is null;
create unique index media_assets_provider_uk on public.media_assets (provider, external_id) where external_id is not null;

-- Global role templates applied by public.bootstrap_tenant() (not tenant data).
create table private.role_templates (
  key         text primary key,
  name        text not null,
  kind        text not null check (kind in ('staff', 'learner', 'guardian')),
  description text,
  permissions text[] not null default '{}',   -- '*' = every permission
  sort_order  int not null default 0
);

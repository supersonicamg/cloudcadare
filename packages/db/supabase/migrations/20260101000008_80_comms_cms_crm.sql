-- =============================================================================
-- 80_comms_cms_crm.sql  —  schema: public
-- Notifications (in-app / email / SMS / WhatsApp / push), website CMS
-- (homepage builder, pages, menus, blog, results showcase, FAQs), forms & CRM.
-- =============================================================================

-- ------------------------------------------------------------- notifications
-- tenant_id NULL = platform default template; a tenant row overrides it.
create table public.notification_templates (
  id                   uuid primary key default private.uuid7(),
  tenant_id            uuid references public.tenants(id) on delete cascade,
  event_key            text not null,     -- 'enrollment.created','live.reminder','test.result_published','installment.due'
  channel              text not null check (channel in ('in_app', 'email', 'sms', 'whatsapp', 'push')),
  locale               text not null default 'en',
  subject              text,
  body                 text not null,     -- Liquid/Handlebars-style variables, rendered server-side
  provider_template_id text,              -- India: DLT template id (SMS) / approved WhatsApp template name
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique nulls not distinct (tenant_id, event_key, channel, locale)
);

create table public.notifications (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null,
  member_id  uuid not null,
  event_key  text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}',
  action_url text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);
create index notifications_inbox_idx  on public.notifications (member_id, created_at desc);
create index notifications_unread_idx on public.notifications (member_id) where read_at is null;

create table public.notification_preferences (
  tenant_id uuid not null,
  member_id uuid not null,
  event_key text not null,          -- '*' = all
  channel   text not null,
  enabled   boolean not null,
  primary key (member_id, event_key, channel),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);

create table public.push_subscriptions (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null,
  member_id  uuid not null,
  platform   text not null check (platform in ('web', 'android', 'ios')),
  token      text not null,          -- FCM/APNs token or Web Push endpoint JSON
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (member_id, token),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);

-- Outbound delivery log (also the usage meter for SMS/WhatsApp/email billing).
create table public.message_deliveries (
  id                  uuid primary key default private.uuid7(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  member_id           uuid,
  channel             text not null check (channel in ('email', 'sms', 'whatsapp', 'push')),
  event_key           text,
  recipient           text not null,
  provider            text not null,
  provider_message_id text,
  status              text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'bounced')),
  error               text,
  cost_minor          bigint,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index message_deliveries_tenant_idx on public.message_deliveries (tenant_id, created_at desc);

-- ---------------------------------------------------------------------- CMS
-- A page is an ordered list of typed blocks: [{"id":"…","type":"hero","props":{…}}, …]
-- Block types & prop schemas are defined in code (packages/cms) and every theme
-- implements a renderer per block type → content is portable across themes.
create table public.site_pages (
  id                   uuid primary key default private.uuid7(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  path                 text not null check (path ~ '^/[a-z0-9/_-]*$'),   -- '/', '/about', '/neet-2027'
  title                text not null,
  template_key         text not null default 'blocks',  -- 'blocks' | theme page template
  blocks               jsonb not null default '[]',     -- DRAFT content (editor)
  published_blocks     jsonb,                           -- LIVE content (rendered)
  seo                  jsonb not null default '{}',
  status               text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_system            boolean not null default false,  -- home, about, contact (cannot delete)
  published_at         timestamptz,
  updated_by           uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, path)
);

create table public.site_page_versions (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null,
  page_id    uuid not null,
  version    int not null,
  blocks     jsonb not null,
  seo        jsonb not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (page_id, version),
  foreign key (tenant_id, page_id) references public.site_pages(tenant_id, id) on delete cascade
);

create table public.site_navigation (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  location   text not null check (location in ('header', 'footer', 'mobile', 'learner_sidebar')),
  items      jsonb not null default '[]',   -- [{"label":"Courses","href":"/courses","children":[…]}]
  updated_at timestamptz not null default now(),
  primary key (tenant_id, location)
);

create table public.blog_posts (
  id               uuid primary key default private.uuid7(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  slug             extensions.citext not null,
  title            text not null,
  excerpt          text,
  body             jsonb not null,
  cover_path       text,
  author_member_id uuid,
  tags             text[] not null default '{}',
  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  seo              jsonb not null default '{}',
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index blog_posts_feed_idx on public.blog_posts (tenant_id, status, published_at desc);

-- Testimonials, toppers / results ("AIR 23 – UPSC 2025"), certifications achieved, press.
create table public.showcase_items (
  id          uuid primary key default private.uuid7(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  kind        text not null check (kind in ('testimonial', 'result', 'achievement', 'press', 'partner')),
  name        text not null,
  photo_path  text,
  headline    text,                 -- 'AIR 23', 'AWS Solutions Architect – Professional'
  body        text,
  exam        text,
  year        smallint,
  video_url   text,
  member_id   uuid,
  is_featured boolean not null default false,
  position    int not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index showcase_items_idx on public.showcase_items (tenant_id, kind, is_published, position);

create table public.faqs (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  context_type text not null default 'site' check (context_type in ('site', 'course', 'product')),
  context_id   uuid,
  question     text not null,
  answer       jsonb not null,
  position     int not null default 0,
  is_published boolean not null default true
);
create index faqs_idx on public.faqs (tenant_id, context_type, context_id, position);

-- ----------------------------------------------------------------- forms & CRM
create table public.forms (
  id              uuid primary key default private.uuid7(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  key             text not null,
  name            text not null,
  fields          jsonb not null default '[]',
  success_message text,
  creates_lead    boolean not null default true,
  notify_emails   text[] not null default '{}',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, key)
);

create table public.leads (
  id                  uuid primary key default private.uuid7(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  full_name           text not null,
  email               extensions.citext,
  phone               text,
  source              text not null default 'website_form'
                      check (source in ('website_form', 'whatsapp', 'walk_in', 'phone', 'referral', 'ads', 'import', 'api', 'demo_class')),
  utm                 jsonb not null default '{}',
  interested_in       uuid[] not null default '{}',  -- product ids
  status              text not null default 'new'
                      check (status in ('new', 'contacted', 'qualified', 'demo_scheduled', 'negotiation', 'converted', 'lost')),
  score               int not null default 0,
  owner_member_id     uuid,
  branch_id           uuid,
  next_follow_up_at   timestamptz,
  converted_member_id uuid,
  lost_reason         text,
  custom_fields       jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, owner_member_id)     references public.tenant_members(tenant_id, id) on delete set null (owner_member_id),
  foreign key (tenant_id, converted_member_id) references public.tenant_members(tenant_id, id) on delete set null (converted_member_id),
  foreign key (tenant_id, branch_id)           references public.branches(tenant_id, id) on delete set null (branch_id)
);
create index leads_pipeline_idx  on public.leads (tenant_id, status, next_follow_up_at);
create index leads_owner_idx     on public.leads (owner_member_id, status);
create index leads_phone_idx     on public.leads (tenant_id, phone);

create table public.lead_activities (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid not null,
  lead_id      uuid not null,
  type         text not null check (type in ('note', 'call', 'email', 'sms', 'whatsapp', 'meeting', 'status_change', 'task')),
  body         text,
  scheduled_at timestamptz,
  done_at      timestamptz,
  by_member_id uuid,
  created_at   timestamptz not null default now(),
  foreign key (tenant_id, lead_id) references public.leads(tenant_id, id) on delete cascade
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

create table public.form_submissions (
  id         uuid primary key default private.uuid7(),
  tenant_id  uuid not null,
  form_id    uuid not null,
  data       jsonb not null,
  lead_id    uuid,
  ip         inet,
  user_agent text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, form_id) references public.forms(tenant_id, id) on delete cascade,
  foreign key (tenant_id, lead_id) references public.leads(tenant_id, id) on delete set null (lead_id)
);
create index form_submissions_form_idx on public.form_submissions (form_id, created_at desc);

-- =============================================================================
-- 70_commerce.sql  —  schema: public
-- What academies sell to learners: products & bundles, prices, coupons,
-- orders, payments (online + offline fee collection), installments, refunds,
-- GST invoices, learner subscriptions, affiliates.
--
-- Money: bigint minor units (paise). All amounts on an order are SNAPSHOTS –
-- later price edits never change history.
-- Payments are written ONLY by server code (webhooks / staff offline entry).
-- =============================================================================

-- Each academy collects money into ITS OWN gateway account (they are the merchant
-- of record). Secrets live in Supabase Vault; we store only the Vault id.
create table public.payment_gateway_accounts (
  id                      uuid primary key default private.uuid7(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  gateway                 text not null check (gateway in ('razorpay', 'stripe', 'cashfree', 'phonepe', 'payu')),
  mode                    text not null default 'test' check (mode in ('test', 'live')),
  public_key              text,                -- e.g. Razorpay key_id (safe for browser)
  secret_vault_id         uuid,                -- vault.secrets.id
  webhook_secret_vault_id uuid,
  is_default              boolean not null default false,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index payment_gateway_default_uk on public.payment_gateway_accounts (tenant_id) where is_default and is_active;

create table public.tax_rates (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  name         text not null,                 -- 'GST 18%'
  rate_pct     numeric(5,2) not null check (rate_pct between 0 and 100),
  hsn_sac_code text,                          -- 999293 (commercial training & coaching)
  is_inclusive boolean not null default true,
  is_active    boolean not null default true,
  unique (tenant_id, id)
);

create table public.products (
  id                   uuid primary key default private.uuid7(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  kind                 text not null check (kind in ('course', 'bundle', 'batch_seat', 'test_series', 'material_pack', 'subscription', 'live_program')),
  slug                 extensions.citext not null,
  title                text not null,
  subtitle             text,
  description          jsonb,
  cover_path           text,
  status               text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  visibility           text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  access_duration_days int check (access_duration_days > 0),   -- overrides course default
  sale_starts_at       timestamptz,
  sale_ends_at         timestamptz,
  max_sales            int,
  sales_count          int not null default 0,
  seo                  jsonb not null default '{}',
  custom_fields        jsonb not null default '{}',
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, slug)
);
create index products_listing_idx on public.products (tenant_id, status, visibility, sort_order) where deleted_at is null;

-- What a product grants. A bundle lists courses and/or other products.
create table public.product_items (
  id               uuid primary key default private.uuid7(),
  tenant_id        uuid not null,
  product_id       uuid not null,
  course_id        uuid,
  batch_id         uuid,
  child_product_id uuid,
  position         int not null default 0,
  check (num_nonnulls(course_id, batch_id, child_product_id) = 1),
  check (child_product_id is null or child_product_id <> product_id),
  foreign key (tenant_id, product_id)       references public.products(tenant_id, id) on delete cascade,
  foreign key (tenant_id, course_id)        references public.courses(tenant_id, id) on delete restrict,
  foreign key (tenant_id, batch_id)         references public.batches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, child_product_id) references public.products(tenant_id, id) on delete restrict
);
create index product_items_product_idx on public.product_items (product_id, position);

create table public.prices (
  id                uuid primary key default private.uuid7(),
  tenant_id         uuid not null,
  product_id        uuid not null,
  label             text not null default 'Standard',   -- 'One-time', '3 EMIs', 'Monthly'
  currency          char(3) not null default 'INR',
  amount_minor      bigint not null check (amount_minor >= 0),
  compare_at_minor  bigint check (compare_at_minor >= 0),   -- strike-through price
  billing_type      text not null default 'one_time' check (billing_type in ('one_time', 'recurring', 'installments')),
  billing_interval  text check (billing_interval in ('week', 'month', 'quarter', 'year')),
  interval_count    int not null default 1,
  installment_plan  jsonb,             -- [{"seq":1,"due_offset_days":0,"pct":40},{"seq":2,"due_offset_days":30,"pct":30},…]
  tax_rate_id       uuid,
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, id),
  check (billing_type <> 'recurring' or billing_interval is not null),
  check (billing_type <> 'installments' or installment_plan is not null),
  foreign key (tenant_id, product_id)  references public.products(tenant_id, id) on delete cascade,
  foreign key (tenant_id, tax_rate_id) references public.tax_rates(tenant_id, id) on delete set null (tax_rate_id)
);
create index prices_product_idx on public.prices (product_id) where is_active;

create table public.coupons (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  code               extensions.citext not null,
  description        text,
  discount_type      text not null check (discount_type in ('percent', 'fixed')),
  discount_value     numeric(12,2) not null check (discount_value > 0),
  max_discount_minor bigint,
  min_order_minor    bigint,
  applies_to         jsonb not null default '{"type":"all"}',   -- all | products:[…]
  max_redemptions    int,
  per_member_limit   int not null default 1,
  redeemed_count     int not null default 0,
  starts_at          timestamptz,
  ends_at            timestamptz,
  is_active          boolean not null default true,
  affiliate_id       uuid,                  -- coupon tied to an affiliate / faculty
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create table public.orders (
  id                uuid primary key default private.uuid7(),
  tenant_id         uuid not null,
  order_no          text not null,               -- human number from tenant_counters ('CC-2026-000123')
  member_id         uuid not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'awaiting_payment', 'paid', 'partially_paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  currency          char(3) not null default 'INR',
  subtotal_minor    bigint not null default 0 check (subtotal_minor >= 0),
  discount_minor    bigint not null default 0 check (discount_minor >= 0),
  tax_minor         bigint not null default 0 check (tax_minor >= 0),
  total_minor       bigint not null default 0 check (total_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  coupon_id         uuid,
  affiliate_id      uuid,
  billing_details   jsonb not null default '{}',  -- name, email, phone, address, GSTIN (B2B), place of supply
  source            text not null default 'web' check (source in ('web', 'app', 'admin', 'offline', 'import', 'api')),
  idempotency_key   text,
  placed_at         timestamptz not null default now(),
  paid_at           timestamptz,
  cancelled_at      timestamptz,
  notes             text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, order_no),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete restrict,
  foreign key (tenant_id, coupon_id) references public.coupons(tenant_id, id) on delete set null (coupon_id)
);
create index orders_member_idx on public.orders (member_id, placed_at desc);
create index orders_status_idx on public.orders (tenant_id, status, placed_at desc);

create table public.order_items (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null,
  order_id           uuid not null,
  product_id         uuid not null,
  price_id           uuid,
  title_snapshot     text not null,
  quantity           int not null default 1 check (quantity > 0),
  unit_amount_minor  bigint not null check (unit_amount_minor >= 0),
  discount_minor     bigint not null default 0,
  tax_minor          bigint not null default 0,
  total_minor        bigint not null,
  tax_snapshot       jsonb not null default '{}',   -- rate, HSN/SAC, CGST/SGST/IGST split
  fulfilled_at       timestamptz,                   -- enrollments granted
  unique (tenant_id, id),
  foreign key (tenant_id, order_id)   references public.orders(tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references public.products(tenant_id, id) on delete restrict,
  foreign key (tenant_id, price_id)   references public.prices(tenant_id, id) on delete set null (price_id)
);
create index order_items_order_idx on public.order_items (order_id);

alter table public.enrollments
  add constraint enrollments_order_item_fk foreign key (tenant_id, order_item_id)
  references public.order_items(tenant_id, id) on delete set null (order_item_id);

create table public.installments (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid not null,
  order_id     uuid not null,
  seq          int not null,
  due_date     date not null,
  amount_minor bigint not null check (amount_minor > 0),
  status       text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'waived', 'cancelled')),
  paid_at      timestamptz,
  reminder_count int not null default 0,
  unique (tenant_id, id),
  unique (order_id, seq),
  foreign key (tenant_id, order_id) references public.orders(tenant_id, id) on delete cascade
);
create index installments_due_idx on public.installments (tenant_id, status, due_date) where status in ('pending', 'overdue');

create table public.payments (
  id                 uuid primary key default private.uuid7(),
  tenant_id          uuid not null,
  order_id           uuid not null,
  installment_id     uuid,
  gateway            text not null check (gateway in ('razorpay', 'stripe', 'cashfree', 'phonepe', 'payu',
                                                       'cash', 'upi_manual', 'bank_transfer', 'cheque', 'card_pos')),
  gateway_order_id   text,
  gateway_payment_id text,
  amount_minor       bigint not null check (amount_minor > 0),
  currency           char(3) not null default 'INR',
  status             text not null check (status in ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  method             text,                -- upi / card / netbanking / wallet / emi
  receipt_no         text,                -- offline receipts
  received_by        uuid,                -- staff who collected offline payment
  failure_reason     text,
  raw                jsonb not null default '{}',   -- sanitized gateway payload
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, order_id)       references public.orders(tenant_id, id) on delete restrict,
  foreign key (tenant_id, installment_id) references public.installments(tenant_id, id) on delete set null (installment_id)
);
create unique index payments_gateway_uk on public.payments (gateway, gateway_payment_id) where gateway_payment_id is not null;
create index payments_order_idx on public.payments (order_id);

create table public.refunds (
  id                uuid primary key default private.uuid7(),
  tenant_id         uuid not null,
  payment_id        uuid not null,
  amount_minor      bigint not null check (amount_minor > 0),
  reason            text,
  status            text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  gateway_refund_id text,
  revoke_access     boolean not null default true,
  initiated_by      uuid,
  processed_at      timestamptz,
  created_at        timestamptz not null default now(),
  foreign key (tenant_id, payment_id) references public.payments(tenant_id, id) on delete restrict
);

-- GST-compliant invoices / credit notes. Numbering per financial year from tenant_counters.
create table public.invoices (
  id             uuid primary key default private.uuid7(),
  tenant_id      uuid not null,
  order_id       uuid not null,
  kind           text not null default 'invoice' check (kind in ('invoice', 'credit_note', 'receipt')),
  invoice_no     text not null,
  issued_at      timestamptz not null default now(),
  seller         jsonb not null,           -- snapshot: legal name, GSTIN, address, state code
  buyer          jsonb not null,           -- snapshot: name, GSTIN (optional), address, place of supply
  lines          jsonb not null,
  totals         jsonb not null,           -- taxable, cgst, sgst, igst, total
  pdf_path       text,
  created_at     timestamptz not null default now(),
  unique (tenant_id, invoice_no),
  foreign key (tenant_id, order_id) references public.orders(tenant_id, id) on delete restrict
);

create table public.member_subscriptions (
  id                       uuid primary key default private.uuid7(),
  tenant_id                uuid not null,
  member_id                uuid not null,
  product_id               uuid not null,
  price_id                 uuid,
  status                   text not null check (status in ('trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired')),
  gateway                  text,
  gateway_subscription_id  text,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  cancelled_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  foreign key (tenant_id, member_id)  references public.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references public.products(tenant_id, id) on delete restrict,
  foreign key (tenant_id, price_id)   references public.prices(tenant_id, id) on delete set null (price_id)
);
create index member_subscriptions_member_idx on public.member_subscriptions (member_id, status);

create table public.coupon_redemptions (
  tenant_id      uuid not null,
  coupon_id      uuid not null,
  order_id       uuid not null,
  member_id      uuid not null,
  discount_minor bigint not null,
  redeemed_at    timestamptz not null default now(),
  primary key (coupon_id, order_id),
  foreign key (tenant_id, coupon_id) references public.coupons(tenant_id, id) on delete cascade,
  foreign key (tenant_id, order_id)  references public.orders(tenant_id, id) on delete cascade
);
create index coupon_redemptions_member_idx on public.coupon_redemptions (coupon_id, member_id);

-- ------------------------------------------------------------------ affiliates
create table public.affiliates (
  id             uuid primary key default private.uuid7(),
  tenant_id      uuid not null,
  member_id      uuid not null,
  code           extensions.citext not null,
  commission_pct numeric(5,2) not null default 10 check (commission_pct between 0 and 100),
  status         text not null default 'active' check (status in ('active', 'paused', 'closed')),
  payout_details jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code),
  foreign key (tenant_id, member_id) references public.tenant_members(tenant_id, id) on delete cascade
);

create table public.affiliate_conversions (
  id               uuid primary key default private.uuid7(),
  tenant_id        uuid not null,
  affiliate_id     uuid not null,
  order_id         uuid not null unique,
  commission_minor bigint not null,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'reversed')),
  created_at       timestamptz not null default now(),
  paid_at          timestamptz,
  foreign key (tenant_id, affiliate_id) references public.affiliates(tenant_id, id) on delete restrict,
  foreign key (tenant_id, order_id)     references public.orders(tenant_id, id) on delete restrict
);

alter table public.coupons add constraint coupons_affiliate_fk
  foreign key (tenant_id, affiliate_id) references public.affiliates(tenant_id, id) on delete set null (affiliate_id);
alter table public.orders add constraint orders_affiliate_fk
  foreign key (tenant_id, affiliate_id) references public.affiliates(tenant_id, id) on delete set null (affiliate_id);

-- Idempotent inbox for gateway webhooks (dedupe on provider event id).
create table public.gateway_webhook_inbox (
  id           uuid primary key default private.uuid7(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  gateway      text not null,
  event_id     text not null,
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  attempts     int not null default 0,
  last_error   text,
  unique (gateway, event_id)
);
create index gateway_webhook_pending_idx on public.gateway_webhook_inbox (received_at) where processed_at is null;

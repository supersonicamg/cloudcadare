# 03 · Distribution & Multi-Tenancy

## 1. Hierarchy

```
control.distributors (tree, parent_id)
  kind=platform  ← exactly one: you. Sees everything.
  kind=reseller  ← sells your platform under its own plans/commission (optional)
  kind=partner   ← referral partner, limited console
        │ 1..n
control.tenants   ← an academy. Belongs to exactly one distributor node.
        │
        ├── control.tenant_domains        (slug.yourplatform.app + custom domains)
        ├── control.tenant_subscriptions  (plan, status, period)
        ├── control.tenant_addons         (+1000 members, DRM, WhatsApp pack…)
        ├── control.tenant_feature_overrides (manual grant/revoke)
        ├── control.tenant_entitlements   (resolved result → synced to data plane)
        ├── control.usage_records         (monthly usage per metric)
        └── data plane: public.* rows with tenant_id = tenants.id
```

**Visibility rule:** a distributor member can act on tenants whose `distributor_id ∈ control.distributor_subtree(their_distributor_id)`. The console DAL enforces this on every query. The control plane is never exposed through the Data API (RLS is on with no policies, and access is through the secret key only).

**Distributor roles:** `owner`, `admin`, `sales` (keys, tenants), `support` (read and impersonate), `finance` (invoices), `viewer`. MFA is mandatory for console users.

## 2. License keys → academy (the "register with a key" flow)

```
Distributor console                         Customer                                   System
───────────────────                         ────────                                   ──────
Create key: plan=Growth,                    
vertical=cloud_training, term=365d,          
frontend=default, addons=[members_1000],     
overrides={...}, max_activations=1,          
restricted_email (optional)                 
  → plaintext shown ONCE: EDU-7KQ2-…-M4XP    
  → stored: sha256(upper(key)), key_hint     
Send to customer ─────────────────────────▶ start.yourplatform.app
                                            1. Sign up / sign in (OTP)
                                            2. Enter key, academy name, slug ─────────▶ control.redeem_license():
                                                                                        • lock key row; validate status, expiry,
                                                                                          activations, email binding, slug reserved?
                                                                                        • distributor active & under max_tenants
                                                                                        • choose data plane (least-loaded pooled)
                                                                                          or create placeholder dedicated plane
                                                                                        • insert tenant, subdomain, subscription,
                                                                                          add-ons, overrides, activation; bump count
                                                                                        • refresh_entitlements(); queue provision job
                                                                                        ▼
                                                                                        provision worker:
                                                                                        • pooled: sync_tenant_local + bootstrap_tenant
                                                                                        • dedicated: create Supabase project via
                                                                                          Management API → run migrations → bootstrap
                                                                                        • Redis: domain → tenant
                                            3. Redirect to slug.yourplatform.app/admin/setup
                                               (guided setup: logo, colours, first course,
                                                payment gateway, invite faculty)
```

Both functions exist in [`database/90_functions.sql`](database/90_functions.sql) and are exercised by the smoke test.

**Key hygiene:**

- Format `EDU-XXXX-XXXX-XXXX-XXXX` (Crockford base32, no ambiguous characters, 80 bits of entropy).
- Rate-limit redemption per IP and per user (Upstash): 5 per hour.
- Keys can be revoked, can expire, can have multiple activations (for a franchise) and can be bound to one email.

**Self-serve signup** (no key) is the same flow with a "free trial" key generated server-side for a public plan. It is turned on per distributor.

## 3. Tenant lifecycle

```
provisioning ─▶ trial ─▶ active ─▶ past_due ─▶ suspended ─▶ cancelled ─▶ archived
                   └───────────────────────────────▲  (resume)    │
                                                                 └─▶ export → delete after retention
```

| Status | Learner experience | Admin experience |
|---|---|---|
| trial / active | Normal | Normal; trial banner |
| past_due | Normal (grace 7–14 days) | Payment banner |
| suspended | Read-only; no new purchases or enrollments; banner | Read-only; billing page only |
| cancelled | Site offline (custom message) | Export only |
| archived | Gone | Gone (data retained per policy, then purged) |

The status lives in `control.tenants`, is mirrored to `public.tenants.status` and is cached in the Redis domain map, so proxy can short-circuit.

## 4. Domains

- **Platform subdomain:** `{slug}.yourplatform.app`, wildcard DNS + wildcard TLS, created at redemption, verified immediately.
- **Custom domain** (feature `site.custom_domain`):
  1. The academy admin enters `learn.cloudcadre.in`.
  2. The server calls the Vercel Domains API (add the domain to the project) and stores the returned verification record (CNAME `cname.vercel-dns.com` or A record, plus TXT if needed) in `tenant_domains.verification_record`.
  3. The admin sees DNS instructions with a live checker (a worker polls every 5 minutes for 72 hours).
  4. On verification the SSL is issued, `verification_status='verified'`, the Redis domain map is updated and the admin can set it primary. The subdomain then 308-redirects to the primary.
- **Apex vs www:** recommend `www`/`learn` subdomains (CNAME) and redirect the apex.
- **Auth redirect URLs:** Supabase needs every redirect host allow-listed. Avoid per-domain allow-listing with an **auth bridge**:
  1. OAuth/magic links go through `auth.yourplatform.app/callback?t={tenant}`.
  2. That exchanges the code, mints a one-time `handoff` token (Redis, 60 s) and redirects to `https://{tenant-domain}/auth/handoff?token=…`.
  3. The tenant domain sets its own session cookie.
  4. Phone/email OTP flows don't need redirects at all, so they are the default.

## 5. Data placement: pooled vs dedicated

| | Pooled (default) | Dedicated (enterprise / proprietary install) |
|---|---|---|
| Where | Shared Supabase project per region (`pooled-ap-south-1-01`, `-02`…) | One Supabase project for the tenant (in your org, or the client's own account) |
| Isolation | RLS + composite tenant FKs + grants | Physical + the same RLS (defense in depth) |
| Identity | Global `auth.users` per plane; per-tenant member profile | Separate Auth, so no shared identity with other academies |
| Cost | Cheap (hundreds of small tenants per project) | Project + compute cost, priced into the plan |
| When | Default for all plans | Enterprise, data-sovereignty demands, very large tenants (>50k active learners), noisy neighbours |
| Migrations | Same files | Same files; CI runs them across all planes |

**Moving a tenant** (pooled → dedicated, or between pooled planes) is a `move_data_plane` provisioning job:

1. Freeze writes (status `maintenance`; proxy shows a maintenance page).
2. `COPY` every table `WHERE tenant_id = X` in FK order. UUIDv7 keys mean no ID collisions.
3. Copy storage objects under the `{tenant_id}/` prefix and re-point video provider asset ownership if needed.
4. Recreate `auth.users` rows for the tenant's members (pooled → dedicated), with password hashes copied where they exist. OTP users just log in again.
5. Verify row counts and checksums, switch `data_plane_id`, update Redis and unfreeze.
6. Delete the source rows after a 7-day safety window.

This is possible because **every data-plane table has `tenant_id`**, even in a dedicated plane (lint #7 in `tests/lint.sql` enforces it).

## 6. Sync: control plane → data plane

Source of truth: `control.*`. Projection: `public.tenants`, `public.tenant_entitlements`.

1. Something changes (plan edit, add-on, override, subscription status, tenant status).
2. A trigger calls `control.refresh_entitlements(tenant)`, or for plan edits an outbox fan-out runs. It writes `control.tenant_entitlements` and a `control.outbox_events` row.
3. The sync worker picks up the event, writes the tenant's data plane (upsert `tenants` and replace `tenant_entitlements`) with that plane's secret key, then calls `revalidateTag('tenant:{id}:features')` through a signed revalidation endpoint on each frontend deployment, and updates Redis.
4. Reconciliation: a nightly job diffs control and data planes and repairs drift (alerting on any diff).

Phase 1 runs the control and data planes in one database, so step 3 is just `control.sync_tenant_local()`.

**Usage flows the other way.** A nightly job aggregates per tenant and upserts `control.usage_records`. Metrics:

- active members (distinct with activity in the period)
- storage bytes
- video minutes (from the provider API)
- SMS, WhatsApp and email counts (from `message_deliveries`)
- AI credits

## 7. Distributor console: screens

| Area | Capabilities |
|---|---|
| **Overview** | MRR/ARR, active tenants by plan and status, trials ending, past-due, usage hot-spots (>80% of a limit), signups, churn |
| **Tenants** | Search and filter; tenant 360°: profile, status timeline, domains, subscription, add-ons, entitlement matrix (source of each value), usage vs limits, health (errors, last activity), staff list, learner counts, revenue (if the academy shares it), audit log, notes |
| **Tenant actions** | Change plan, add add-ons, override features/limits (with reason and expiry), extend the trial, suspend/resume, move data plane, export data, impersonate ("Login as admin", read-only by default, max 4 h, reason required, banner shown, audited in both the control audit log and the tenant audit log), reset the owner, rotate the domain, set the frontend (theme or custom app) |
| **Licenses** | Create single or batch keys (CSV export of plaintext *once*), filter by status, revoke, see activations |
| **Plans & add-ons** | Plan builder: a matrix of features × plans with limits; versioning (existing subscribers keep their version until migrated); preview the resolved entitlements for a sample tenant |
| **Features** | Catalog, lifecycle (alpha/beta/GA/deprecated), dependency graph, beta rollout to chosen tenants via overrides |
| **Templates** | Verticals (terminology, disabled modules, seed), frontend templates (themes, custom apps, their deployment URLs) |
| **Distributors** | (Platform only) reseller tree, commission %, max tenants, allowed plans, white-label console branding |
| **Billing** | Platform invoices to tenants, payments (Razorpay subscriptions), reseller payouts/commission statements, GST |
| **Data planes** | Planes, capacity, schema version per plane, migration status, health |
| **Announcements** | Banners and in-app notices to tenants by plan or segment |
| **Audit & security** | Control audit log, impersonation sessions, console user management, MFA status |

## 8. Proprietary / on-prem style deliveries

"Make it a proprietary software for them personally" is covered by three options. Pick per deal.

1. **Dedicated plane in your org.** You operate it. Simplest, recommended.
2. **Dedicated plane in the client's Supabase org.** You hold a deploy role. Migrations run from your CI. A license heartbeat (usage + entitlements) keeps the control plane in charge.
3. **Self-hosted Supabase + self-hosted Next.js** (Docker/Kubernetes). Highest effort; only for large contracts. Entitlements are signed (JWS with your private key) and verified offline by the app, so toggles still work without network access to your control plane.

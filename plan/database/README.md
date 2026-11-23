# Database: executable schema

Target: **Supabase Postgres 17**.

Each file is one migration, applied in numeric order. Copy them into `packages/db/supabase/migrations/` with timestamp prefixes when the monorepo is created; they are the source of truth for the schema.

| File | Contents |
|---|---|
| `00_foundation.sql` | Extensions, schemas (`control`, `private`), default-deny privileges, `private.uuid7()`, `set_updated_at`, monthly partition helper |
| `10_control_plane.sql` | Distributors (tree), members, features, verticals, frontend templates, data planes, plans, add-ons, tenants, domains, license keys, subscriptions, overrides, entitlements, usage, invoices, impersonation, provisioning jobs, outbox, announcements, audit |
| `20_tenant_core.sql` | Tenancy mirror, entitlements projection, module toggles, branding, settings, counters, branches, members, permission catalog, roles, scoped role grants, invitations, guardians, instructor profiles, custom fields, devices, consents, DSR, taxonomy, media library |
| `30_catalog_content.sql` | Courses (kinds), instructors, nested sections, lessons, resources, batches, batch courses and faculty, per-batch release, live sessions (+ host secrets), attendance, syllabus plans, items and coverage |
| `40_learning.sql` | Enrollments, lesson progress, notes, daily activity, learning events (partitioned), certificate templates and certificates |
| `50_assessments.sql` | Questions, answer keys, question stats, tests, sections, test questions, attempts, answers, assignments, submissions |
| `60_engagement.sql` | XP ledger, levels, member stats, badges, leaderboards and entries, discussions, votes, reports, reviews, announcements |
| `70_commerce.sql` | Gateway accounts, tax rates, products, bundle items, prices, coupons, orders, items, installments, payments, refunds, invoices, learner subscriptions, redemptions, affiliates, webhook inbox |
| `80_comms_cms_crm.sql` | Notification templates, inbox, preferences, push, deliveries, CMS pages and versions, navigation, blog, showcase, FAQs, forms, leads, lead activities, submissions |
| `85_platform_ops.sql` | Audit log (partitioned), transactional outbox, API keys, webhooks, integrations, import jobs |
| `90_functions.sql` | RLS helpers, feature and limit helpers, entitlement resolution, license redemption, sync, tenant bootstrap, progress RPC, test engine RPCs + grading + ranks, leaderboards, reporting views, triggers (counters, XP → stats, limits, audit, control refresh, updated_at) |
| `95_rls_policies.sql` | Enable RLS everywhere, revoke defaults, policy builders, per-table policies and grants, RPC grants |
| `96_storage.sql` | Buckets (`public-assets`, `course-media`, `submissions`, `exports`) and path-based policies |
| `97_fk_indexes.sql` | Covering indexes for every foreign key not already indexed |
| `99_seed_catalog.sql` | Platform settings, 85 features, 61 permissions, 10 role templates, 6 verticals, 4 frontend templates, reserved slugs, platform distributor, first pooled plane, 4 plans with limits, 4 add-ons, default notification templates |

## Run it locally

```bash
./plan/database/tests/run_local.sh        # needs podman or docker; uses public.ecr.aws/supabase/postgres:17.11.0.011
```

The script performs these steps:

1. Starts a fresh container.
2. Adds Storage table stubs (`tests/00_local_stubs.sql`). The bare image has no storage-api; the stubs are test-only.
3. Applies every migration.
4. Runs `tests/smoke_test.sql`.
5. Runs `tests/lint.sql`.

Last run: all migrations applied, `ALL SMOKE TESTS PASSED`, all 7 lints at 0 findings.

## What the smoke test proves

- A license key is single-use. Redemption creates the tenant, subdomain, subscription, add-ons and overrides, and provisioning bootstraps roles, owner, settings, levels, badges, starter site and leaderboards.
- Entitlements: plan contents, unlimited (`NULL`) limits, add-on stacking (2 × +1000), override precedence, dependency cascade, vertical `disabled_modules`.
- RLS:
  - A learner sees only their tenant and their own member row.
  - Answer keys are invisible; payment inserts and enrollment updates are denied.
  - A different tenant's owner cannot read or write tenant A.
  - An instructor sees the question bank and results but not finance.
- Progress: watch-% rule, 120 s heartbeat cap, course completion at threshold.
- Test engine: the paper contains no keys, answers to foreign questions are rejected, and grading of +4/−1 with an MCQ-multi miss and a numeric miss scores exactly 2; a closed attempt is not resumed.
- Gamification: XP ledger → member stats (115 XP), streak, leaderboard snapshot.
- Plan limit enforced by trigger (`plan_limit_reached:limit.courses`).
- Faculty syllabus tracking: expected 66.7%, actual 50.0%, 1 delayed item.
- Audit trail and transactional outbox populated.

## Supabase project setup notes

- Enable extensions: `pg_cron`, `pgmq` (Queues), `supabase_vault`, `pg_net` (optional).
- **Data API exposed schemas:** `public` only. Never expose `control` or `private`.
- Auth:
  - Asymmetric JWT signing keys on.
  - Phone provider through the **Send SMS Hook** (MSG91 DLT).
  - Leaked-password protection on.
  - MFA (TOTP) on.
  - Redirect URLs: `https://auth.yourplatform.app/**` (auth bridge) plus local and preview hosts.
- Cron jobs to register (see `plan/10-api-events-jobs.md` §4):

  ```sql
  select cron.schedule('close-attempts', '* * * * *',    $$select private.close_expired_attempts()$$);
  select cron.schedule('partitions',     '15 2 * * *',   $$select private.ensure_monthly_partitions('public.learning_events', 3); select private.ensure_monthly_partitions('public.audit_logs', 3)$$);
  select cron.schedule('leaderboards',   '*/10 * * * *', $$select private.refresh_leaderboard(id) from public.leaderboards where is_active$$);
  ```

- Per-role statement timeouts: `alter role authenticated set statement_timeout = '8s';`

## Next steps when implementing

- Convert `tests/smoke_test.sql` into pgTAP files under `packages/db/supabase/tests/`, plus a generated RLS matrix (table × persona × operation).
- Run `supabase gen types typescript` → `packages/db/src/types.ts`. Generate `packages/features/catalog.ts` and `packages/permissions/catalog.ts` from the seed tables.
- Replace `yourplatform.app` in `99_seed_catalog.sql` with the real base domain.

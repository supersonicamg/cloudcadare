# 11 · DevOps, Quality & Operations

## 1. Environments

| Env | Supabase | Vercel | Domains | Data |
|---|---|---|---|---|
| Local | `supabase start` (Docker) | `pnpm dev` (Turbopack) | `*.lvh.me:3000` (wildcard → 127.0.0.1) for multi-tenant testing | Seed script: 3 demo tenants (cloud, NEET, K-12), users per role |
| Preview | **Supabase Branching** (per PR, migrations + seed) | Preview deployments per PR | `pr-123.preview.yourplatform.app` + `?tenant=` override (preview only) | Seed |
| Staging | `staging` project (control + pooled) | `staging` | `*.staging.yourplatform.app` | Anonymized copy (monthly), load tests |
| Production | `control` project + `pooled-ap-south-1-0N` + dedicated planes | `production` (academy, console, custom zones) | `*.yourplatform.app` + custom | Real |

Secrets: Vercel encrypted env plus Supabase Vault. There is no `.env` with production secrets on laptops. Separate Razorpay and Mux sandbox accounts exist for non-production environments.

## 2. Repository workflow

- Trunk-based. Short-lived branches → PR → required checks → squash merge → auto-deploy to staging → manual promote to production (or auto with canary).
- Conventional commits, Changesets for package versions, CODEOWNERS (DB and security files need two approvals).
- **Required checks:**
  1. typecheck, lint (incl. import boundaries), unit tests (Vitest)
  2. **DB:** migrations apply on a fresh DB, `tests/lint.sql` reports zero findings, the pgTAP RLS matrix passes, and `supabase db diff` shows no drift
  3. Build of **every app** (academy, console, workers, each custom zone): a core change cannot break a client app silently
  4. Playwright journeys (learner: signup → buy (sandbox) → learn → test → certificate; admin: create course → publish; faculty: attendance → coverage) against the preview
  5. Visual regression per theme (Storybook + Playwright screenshots)
  6. Lighthouse CI budgets on public pages; axe accessibility
  7. Security: `pnpm audit`/OSV, gitleaks, CodeQL

## 3. Database migrations across many planes

- **Source of truth:** `packages/db/supabase/migrations/*.sql`, which starts as the files in `plan/database`, one migration per file, timestamped.
- **Rules:**
  - **Expand → migrate → contract:** add a nullable column → backfill in batches → deploy code using it → enforce `NOT NULL` → drop the old column in a later release.
  - No long locks: use `CREATE INDEX CONCURRENTLY` (in its own migration, outside a transaction), add constraints `NOT VALID` then `VALIDATE`, avoid table rewrites on big tables.
  - Every migration is backward-compatible with the previous app version (blue/green safe).
- **Fan-out:**
  1. A GitHub Actions matrix over `control.data_planes` (active), run in sequence: staging → canary plane → remaining pooled planes → dedicated planes (in parallel, 5 at a time).
  2. Each run records `schema_version` back to `control.data_planes`.
  3. The console shows planes lagging behind. The app refuses to start against a plane more than one version behind (health check).
- **Generated artefacts:** `supabase gen types typescript` → `packages/db/types.ts`; the feature and permission catalogs → `packages/features/catalog.ts` and `packages/permissions/catalog.ts` (CI fails if they are stale).

## 4. Testing strategy

| Layer | Tooling | What |
|---|---|---|
| DB | pgTAP (`supabase test db`) + `tests/smoke_test.sql` + `tests/lint.sql` | RLS matrix per table × persona; RPC behaviour (progress rules, grading per question type, deadlines); entitlement resolution; limits; triggers |
| Domain | Vitest | Pure business rules (pricing, GST split, unlock evaluation, badge criteria, schedule generation) with table-driven tests |
| Integration | Vitest + local Supabase | Server actions with real DB: authz (wrong tenant / no perm / feature off) for **every** action – generated test skeletons |
| Contracts | Zod-generated OpenAPI + schemathesis | REST v1 |
| E2E | Playwright (multi-tenant hosts via `lvh.me`) | Critical journeys per persona; per custom app |
| Load | k6 | Heartbeats, exam burst, checkout spikes, public page RPS |
| Visual / a11y | Storybook, Playwright screenshots, axe | Themes & blocks |

## 5. Observability

- **Tagging:** every log, trace and error carries `tenant_id`, `tenant_slug`, `member_id` (hashed), `request_id` and `plane`.
- **Errors:** Sentry for Next.js and workers, with release health and alerts on new error types or regressions.
- **Tracing:** OpenTelemetry via `instrumentation.ts` → Sentry or Axiom. Supabase query timings are included.
- **Logs:** structured JSON (pino) → Axiom/Better Stack. PII is redacted at the logger.
- **Metrics/SLOs:**
  - availability 99.9% (public pages, learner app)
  - p95 latency budgets (see [08 §7](08-data-model-and-performance.md))
  - webhook processing lag under 60 s
  - outbox lag under 2 min
  - notification delivery rate
- **Per-tenant health** in the console: error rate, p95, last activity, usage vs limits, failed webhooks, failed payments.
- **Alerting:** PagerDuty or Better Stack on-call for the SLO burn rate, outbox dead letters, payment webhook failures, auth error spikes, DB CPU above 80% or replication lag.
- **Status page:** `status.yourplatform.app`, with per-component incidents and email subscriptions for academy owners.

## 6. Operations runbooks (to write before launch)

1. Tenant onboarding issues (domain stuck, SSL, auth redirect).
2. Payment captured but no enrollment: reconcile and run manual fulfilment.
3. Exam-day incident: extend the deadline for the test, the batch or one candidate (`deadline_at` update and audit); re-open an attempt.
4. Provider outage (video, SMS, WhatsApp): use the kill switch and fallback channel.
5. Suspected data leak or breach: the DPDP 72-hour process, audit log queries, key rotation.
6. Restoring one tenant from backup.
7. Moving a tenant between planes.
8. Rotating secrets (gateway keys, Supabase keys, webhook secrets).

## 7. Cost model (indicative, Stage S0–S1)

| Item | Monthly (approx.) |
|---|---|
| Supabase Pro + compute (control + 1 pooled plane, Medium/Large) | $75–$300 |
| Vercel Pro (team seats + usage) | $40–$200 |
| Upstash, Sentry, Axiom, PostHog (free → starter tiers) | $0–$150 |
| Trigger.dev | $0–$50 |
| Mux / Bunny (pass through to tenants via `limit.video_hours` pricing) | usage |
| SMS / WhatsApp / email (pass through with margin) | usage |
| Dedicated tenant | +$25–$400 per tenant (priced into Enterprise) |

Usage-heavy costs (video, messaging) are metered per tenant (`usage_records`) and sold as plan limits and add-ons, so margins hold as tenants grow.

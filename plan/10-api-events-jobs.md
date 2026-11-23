# 10 · API Surface, Domain Events & Jobs

## 1. Four ways in, one core

| Surface | Used by | Auth | Implementation |
|---|---|---|---|
| **Server Components + DAL** | All Next.js frontends (reads) | Session cookie → user-scoped Supabase client | `packages/core/*/queries.ts` → DTOs |
| **Server Actions** | All Next.js frontends (writes) | Session cookie; same-origin | `packages/core/*/actions.ts` (Zod → assertFeature → assertPermission → service → updateTag) |
| **Postgres RPCs** | Latency-critical learner calls (progress heartbeat, test engine) | User JWT; SECURITY DEFINER with internal checks | `90_functions.sql` |
| **REST API v1** | Mobile app, custom frontends in other frameworks, academy integrations (API keys), webhooks consumers | Bearer user JWT **or** tenant API key (`integrations.api`) | Route Handlers in `apps/academy/app/api/v1/[...]` calling the same `@core` services; OpenAPI generated from Zod |

**Rule:** business logic exists once, in `@core` services. Actions, REST handlers and workers are thin adapters.

## 2. REST v1 outline

```
Auth / me
  GET    /api/v1/me                         profile, memberships, effective features
  GET    /api/v1/me/enrollments             my courses + progress
  GET    /api/v1/me/stats                   xp, level, streak, badges, ranks
  GET    /api/v1/me/notifications           inbox (cursor)          PATCH …/{id}/read
  GET    /api/v1/me/calendar.ics?token=     live classes & tests

Catalog
  GET    /api/v1/courses?category=&q=&cursor=
  GET    /api/v1/courses/{slug}             detail + outline (public fields)
  GET    /api/v1/products/{slug}            prices, items

Learning
  GET    /api/v1/courses/{id}/curriculum    with lock state for caller
  GET    /api/v1/lessons/{id}/content       signed playback/doc URL (entitlement + unlock checked)
  POST   /api/v1/lessons/{id}/progress      → record_lesson_progress
  CRUD   /api/v1/lessons/{id}/notes

Assessment
  POST   /api/v1/tests/{id}/attempts        → start_test_attempt
  GET    /api/v1/attempts/{id}/paper        → get_attempt_paper
  PUT    /api/v1/attempts/{id}/answers/{qid}→ save_attempt_answer
  POST   /api/v1/attempts/{id}/submit       → submit_test_attempt
  GET    /api/v1/attempts/{id}/result       respects result/answer visibility

Commerce
  POST   /api/v1/checkout                   {productId, priceId, coupon?} → order + gateway payload
  GET    /api/v1/orders/{id}                status polling
  GET    /api/v1/me/orders · /me/installments · /me/invoices/{id}.pdf

Staff (API-key scopes: members:read, members:write, enrollments:write, orders:read, …)
  GET/POST /api/v1/admin/members           bulk upsert by email/phone/member_code
  POST     /api/v1/admin/enrollments       grant access
  GET      /api/v1/admin/orders?since=
  GET      /api/v1/admin/reports/{key}

Webhooks (inbound)
  POST   /api/webhooks/{razorpay|stripe|mux|bunny|vdocipher|zoom|hms|msg91|whatsapp}/{tenantId?}

Internal
  POST   /api/internal/revalidate          signed by workers → revalidateTag(tags[])
```

**Conventions:**

- **Pagination:** cursor-based (`?cursor=` holds an opaque `(created_at, id)`).
- **Errors:** RFC 9457 problem+json, with `code` values such as `plan_limit_reached`, `feature_disabled`, `not_enrolled`.
- **Idempotency:** `Idempotency-Key` on POST (stored on orders, imports).
- **Rate limits:** per key and per user (Upstash), reported in `RateLimit-*` headers.
- **Versioning:** `/v1` frozen once public; additive changes only.

## 3. Domain event catalog (outbox)

Events are written in the same transaction as the change (`public.outbox_events`). The dispatcher:

1. claims batches: `SELECT … WHERE published_at IS NULL AND available_at <= now() ORDER BY available_at LIMIT 200 FOR UPDATE SKIP LOCKED`
2. routes each event to its handlers
3. marks it published
4. on failure, retries with exponential backoff (`attempts`, `available_at`); after 10 attempts the event goes to the dead-letter view plus an alert

| Event | Emitted by | Handlers |
|---|---|---|
| `member.joined` | signup / invite accept / import | welcome notification, CRM lead conversion, webhook |
| `enrollment.created` / `.expired` / `.cancelled` | fulfilment, admin, cron | notifications, member stats, webhook, analytics |
| `lesson.completed` | `record_lesson_progress`, grading | badge rules, webhook, analytics |
| `course.completed` | progress recompute | certificate issue (if enabled), badge rules, review request (3 days later), webhook |
| `test.graded` | `grade_attempt` | badge rules, result notification (if immediate), question stats update, analytics |
| `test.results_published` | staff action / window close | `compute_test_ranks`, notifications to all candidates + guardians |
| `assignment.submitted` / `.graded` | actions | grader queue notification / learner notification |
| `live.scheduled` / `.starting` / `.ended` | scheduler, cron, provider webhook | reminders, attendance pull, recording ingest |
| `syllabus.coverage_logged` | faculty action | variance recompute, coordinator alerts |
| `doubt.created` / `.answered` | discussions | routing to faculty, SLA timer, notifications, XP for accepted answer |
| `badge.awarded` | trigger | notification + realtime toast, XP |
| `order.paid` / `.refunded` | webhook worker | fulfilment / access revoke, invoice/credit note, affiliate commission, webhook |
| `installment.due` / `.overdue` | cron | reminders (email/SMS/WhatsApp), guardian notice, optional access pause |
| `lead.created` / `.converted` | forms, CRM | counsellor assignment & notification |
| `tenant.entitlements_changed` (control) | `refresh_entitlements` | sync to data plane, cache revalidation, Redis update |
| `tenant.status_changed` (control) | console | sync, Redis domain map, banner |
| `plan.features_changed` (control) | trigger | batched refresh for all tenants on the plan |

Handlers must be **idempotent**, keyed by event id (store processed ids per handler, or rely on natural idempotency such as `xp_ledger.idempotency_key` or `ON CONFLICT`).

## 4. Scheduled jobs

| Job | Schedule | Where |
|---|---|---|
| Outbox dispatcher | every 10–30 s | Trigger.dev |
| `private.close_expired_attempts()` | every 1 min | pg_cron |
| Live reminders (T-24h, T-15m) | every 5 min | Trigger.dev |
| Leaderboard snapshots (`refresh_leaderboard` per active board) | every 5–15 min | pg_cron |
| Enrollment expiry + renewal reminders | hourly | Trigger.dev |
| Installment due/overdue | daily 09:00 tenant TZ | Trigger.dev |
| At-risk learner detection & nudges | daily | Trigger.dev |
| Syllabus variance digest | weekly (Mon 08:00) | Trigger.dev |
| Partition maintenance (`ensure_monthly_partitions`) | daily | pg_cron |
| Retention purge (notifications, outbox, inbox) | daily | pg_cron |
| Usage roll-up → `control.usage_records` | daily | Trigger.dev |
| Entitlement reconciliation (control ↔ planes) | nightly | Trigger.dev |
| Payment reconciliation with gateways | daily | Trigger.dev |
| Question stats / item analysis | nightly | Trigger.dev |
| Domain verification polling | every 5 min (pending only) | Trigger.dev |
| Backups to secondary storage | daily | GitHub Actions / Trigger.dev |

## 5. Outbound webhooks (academy integrations)

- Subscribed per `webhook_endpoints.events`.
- **Signed payload:** `X-Signature: t=…,v1=HMAC_SHA256(secret, t + "." + body)`.
- **Retries:** 1 m, 5 m, 30 m, 2 h, 6 h, 24 h, then the delivery is marked dead and the admin is alerted. An endpoint is auto-disabled after 50 consecutive failures.
- **Delivery log and replay** button in admin.

## 6. SDK

`packages/sdk` is generated from the OpenAPI spec (Zod → OpenAPI → typed client). It is used by the future Expo app and by any custom frontend not written in Next.js. The core learner-kit hooks have SDK-backed variants for React Native.

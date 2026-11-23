# 02 · System Architecture

## 1. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Web framework | **Next.js 16 (App Router)**, React 19, TypeScript strict | Server Components, Server Actions, `proxy.ts` for host routing, Cache Components (`'use cache'` + `cacheTag`), multi-zones for custom frontends |
| Styling / UI | Tailwind CSS v4 + shadcn/ui (Radix primitives) + CSS-variable design tokens | Theming at runtime through tokens; components are owned code, not a black box |
| Database | **Supabase Postgres 17** | RLS for tenant isolation, Auth, Storage, Realtime, Queues (pgmq), Cron, Vault, Edge Functions in one managed service |
| Auth | Supabase Auth (phone OTP, email OTP/magic link, Google, password optional, SAML for enterprise) with asymmetric JWT signing keys | Native RLS integration; `getClaims()` verifies JWTs locally (fast in proxy) |
| Validation | Zod 4 | One schema for forms, server actions, CMS blocks, JSON columns |
| Data access | `@supabase/ssr` + supabase-js (user-scoped, RLS on) for app code; `postgres.js`/Kysely in workers for heavy SQL | RLS stays in force on normal paths; workers get full SQL |
| Background work | **Trigger.dev** (durable tasks, retries, schedules) + Supabase Cron for in-DB jobs | Video processing, bulk import, PDFs, notifications fan-out, sync |
| Cache / rate limit | Next.js Cache Components (tag invalidation) + **Upstash Redis** (domain map, rate limits, hot leaderboards) | Edge-friendly, serverless |
| Video | Mux (default) / Bunny Stream (budget) / VdoCipher (DRM, India) behind an adapter | Transcoding, HLS, signed playback, DRM as an add-on |
| Files | Supabase Storage (S3-compatible, CDN). Cloudflare R2 later for very large archives | Path-based RLS policies |
| Payments | Razorpay (India, default), Stripe (international), Cashfree/PhonePe optional | Each academy uses its own merchant account |
| Messaging | Resend or AWS SES (email), MSG91 (SMS + DLT), WhatsApp Cloud API via Gupshup/Interakt, Web Push/FCM | India compliance (DLT templates) |
| Live classes | Zoom, Google Meet, MS Teams, 100ms (in-app) via adapter; plain link for "custom" | Don't build video conferencing |
| Search | Postgres FTS + `pg_trgm` → Typesense/Meilisearch when catalogs exceed ~50k items | Start simple |
| Observability | Sentry (errors), OpenTelemetry via `instrumentation.ts`, Axiom/Better Stack (logs), PostHog (product analytics, session replay) | — |
| Hosting | **Vercel** (wildcard + custom domains via Domains API) | Multi-tenant domains are first-class. Alternatives: AWS (OpenNext) or Cloudflare (vinext/OpenNext) |
| Region | Supabase `ap-south-1` (Mumbai), Vercel `bom1` functions | Latency and DPDP data residency |
| Monorepo | **Turborepo + pnpm workspaces** | Shared core packages, many frontends |
| Testing | Vitest, Playwright, pgTAP (RLS tests), k6 (load) | — |
| i18n | next-intl, per-tenant enabled locales | English + Hindi + regional |

## 2. Monorepo layout

The current repo is a single default Next.js app. It becomes this monorepo; the existing app is replaced by `apps/academy`.

```
/
├── apps/
│   ├── academy/                # Shared multi-tenant app: public site + learner + instructor + admin
│   ├── console/                # Distributor console (console.yourplatform.app)
│   ├── start/                  # Onboarding: sign up + redeem license (could be a route group of console)
│   ├── web-cloudcadre/         # OPTIONAL custom learner frontend for one client (multi-zone)
│   ├── workers/                # Trigger.dev tasks (outbox dispatcher, media, notifications, sync, reports)
│   └── mobile/                 # (later) Expo app consuming @core/sdk
├── packages/
│   ├── db/                     # supabase/migrations (the SQL in plan/database), seed, generated types, pgTAP tests
│   ├── core/                   # DOMAIN: services per module (server-only). All business rules live here.
│   │   └── src/{catalog,content,enrollment,progress,assessment,cohort,live,gamification,commerce,crm,cms,comms,people}/
│   ├── tenancy/                # Host → tenant resolution, TenantContext, domain cache
│   ├── auth/                   # Supabase clients (browser / server / service), session, guards, MFA helpers
│   ├── features/               # Typed feature catalog (generated), isEnabled(), requireFeature(), <Feature/>
│   ├── permissions/            # Typed permission catalog (generated), can(), requirePermission(), <Can/>
│   ├── ui/                     # Design system: tokens → CSS vars, shadcn primitives, layout shells
│   ├── learner-kit/            # Functional components: VideoPlayer, PdfViewer, TestEngine, CurriculumTree,
│   │                           #   ProgressRing, Leaderboard, BadgeGrid, Certificate… (headless hooks + default skin)
│   ├── cms/                    # CMS block schemas (zod) + BlockRenderer contract + editor
│   ├── themes/
│   │   ├── default/            # ThemeContract implementation
│   │   ├── aurora/
│   │   └── minimal/
│   ├── integrations/           # Ports & adapters: payments, video, meetings, sms, whatsapp, email, push
│   ├── sdk/                    # Typed REST v1 client (mobile, custom apps, 3rd parties)
│   ├── i18n/                   # Base messages, terminology resolver ("Batch" → "Cohort")
│   └── config/                 # eslint (incl. import boundaries), tsconfig, tailwind preset
└── plan/                       # ← this planning package
```

**Import boundaries** (ESLint `boundaries` / `no-restricted-imports`):

- `apps/*` may import `packages/*`. Packages never import apps.
- `packages/core` is `server-only`. Client code reaches it only through server actions, route handlers or RPCs.
- The **service-role Supabase client** may only be imported from `packages/core/src/**/privileged/*` and `apps/workers`. Any other import fails lint.
- Themes may import `ui`, `learner-kit`, `cms`, `features` and `i18n`, but never `core`. Themes are presentation only.

## 3. Runtime topology

```
Browser / PWA / Mobile
   │  HTTPS (academy.com, slug.yourplatform.app, console.yourplatform.app)
   ▼
Vercel Edge ── proxy.ts ───────────────┐  Host → tenant (Redis/Edge Config, ~1ms)
   │                                    │  rewrite → /{tenant}/{path} ; optimistic auth redirect
   ▼                                    │
Next.js server (Node runtime, bom1)     │
   ├── Server Components ── DAL (@core) ┼──▶ Supabase (user JWT → RLS)
   ├── Server Actions    ── DAL         │      Postgres · Auth · Storage · Realtime
   ├── Route Handlers: /api/v1/*, /api/webhooks/*                         ▲
   └── 'use cache' (tags: tenant:{id}:branding, :catalog, :page:/path…)   │
                                                                          │
Trigger.dev workers ── outbox dispatcher · sync · media · notifications ──┘
   │
   ├──▶ Mux/Bunny/VdoCipher   ├──▶ Razorpay/Stripe   ├──▶ MSG91/WhatsApp/Resend
   └──▶ Zoom/Meet/100ms       └──▶ Upstash Redis     └──▶ Sentry/Axiom/PostHog
```

## 4. Request lifecycle (tenant site)

1. **`proxy.ts`** (one per app; Next 16 renamed Middleware to Proxy):
   - Normalize the host and look up `host → {tenantId, slug, planeId, frontend, status}` in Upstash Redis, falling back to Edge Config. **Never query Postgres in proxy.** The docs warn that proxy is not for slow data fetching, and `fetch` caching does not apply there.
   - Unknown host → platform 404 page. Suspended tenant → rewrite to `/suspended`.
   - If the host is served by a custom frontend (`frontend = custom:*`), only the paths that zone owns are rewritten there (see [05](05-frontend-customization.md)).
   - Rewrite to `/{slug}{pathname}` so `app/[tenant]/…` receives the slug as a **root param**.
   - Refresh the Supabase session cookie with `@supabase/ssr`. Optionally redirect unauthenticated users away from `/learn` and `/admin` (an *optimistic* check only).
2. **Root layout `app/[tenant]/layout.tsx`**:
   - `import { tenant } from 'next/root-params'` → `getTenantContext()` (`React.cache` per request).
   - `getBranding(tenantId)` is a `'use cache'` function with `cacheTag(\`tenant:${id}:branding\`)` and `cacheLife('hours')`.
   - Injects design tokens as CSS variables on `<html>`, loads the theme package (`themes[branding.theme_key]`) and wraps children in `<TenantProvider features terminology>`.
   - Uses `generateStaticParams` returning a placeholder tenant (required with Cache Components). Real tenants render on demand and are then cached.
3. **Page**: calls DAL functions (`@core/catalog.getPublishedCourses()`). The DAL:
   - resolves the tenant from context (never from client input)
   - checks the feature (`requireFeature('catalog.courses')`) and the permission where relevant
   - queries Supabase with the **user-scoped client**, so RLS applies
   - returns a minimal DTO
4. **Mutations** use Server Actions. Root params aren't available in server actions or route handlers, so the tenant is resolved from `headers().get('host')` through the same tenancy package. Each action:
   - validates input with Zod
   - checks the permission (`requirePermission('course.manage')`)
   - calls the service
   - calls `updateTag(\`tenant:${id}:catalog\`)` for read-your-writes
5. **Public anonymous pages** (home, catalog, course page) are rendered from cached server functions. The service reads them through a dedicated *public-read* DAL module with explicit `tenant_id` filters (the `anon` role has no database access).

```ts
// packages/tenancy/src/context.ts (sketch)
import 'server-only'
import { cache } from 'react'
import { tenant } from 'next/root-params'
import { headers } from 'next/headers'

export const getTenantContext = cache(async () => {
  const slug = await tenant().catch(() => null)            // pages & layouts
    ?? await slugFromHost((await headers()).get('host'))   // server actions & route handlers
  const t = await loadTenantBySlug(slug)                   // 'use cache' + cacheTag(`tenant:${slug}`)
  if (!t || t.status === 'archived') notFound()
  return t                                                 // { id, slug, status, planeId, timezone, locale, theme, … }
})
```

## 5. Caching strategy

| Data | Mechanism | Tag(s) | Invalidated by |
|---|---|---|---|
| Host → tenant map | Upstash Redis (edge) | `domain:{host}` | Domain verified/changed, tenant suspended (console action → worker) |
| Tenant context, branding, navigation, terminology | `'use cache'` + `cacheLife('hours')` | `tenant:{id}:branding` | Branding or settings saved (`updateTag`) |
| Entitlements and modules | `'use cache'` (short) | `tenant:{id}:features` | Sync worker after `tenant.entitlements_changed` (`revalidateTag`) |
| Public catalog, course pages, CMS pages | `'use cache'` + `cacheLife('days')` | `tenant:{id}:catalog`, `tenant:{id}:page:{path}` | Publish/unpublish (`updateTag`) |
| Leaderboards | `leaderboard_entries` snapshot (DB) + optional Redis ZSET for live | `tenant:{id}:lb:{key}` | Cron every 5–15 min |
| Learner-specific data (progress, dashboard) | Not shared-cached. Use `React.cache` per request and `'use cache: private'` where helpful | — | — |
| Signed media URLs | Never cached beyond their TTL | — | — |

Rule: **anything user-specific is never placed in a shared cache.** Cache keys for shared data always include `tenantId`.

## 6. Data planes in code

```ts
// packages/auth/src/clients.ts (sketch)
export async function getDb() {                       // user-scoped, RLS on
  const t = await getTenantContext()
  const plane = await getPlane(t.planeId)             // { url, publishableKey } – cached
  return createServerClient(plane.url, plane.publishableKey, { cookies: await cookies() })
}
export async function getPrivilegedDb() {            // secret key – ONLY from core/**/privileged/*
  const t = await getTenantContext()
  const plane = await getPlane(t.planeId)
  return createClient(plane.url, await getSecret(plane.secretRef), { auth: { persistSession: false } })
}
```

- **Phase 1:** one Supabase project holds the `control` schema and the pooled data plane, so the sync is a function call (`control.sync_tenant_local`).
- **Later:** the control plane gets its own project and dedicated tenants get their own projects. Code paths don't change: `getPlane()` returns different credentials.
- Auth cookies are per domain, and each data plane has its own Auth, so dedicated tenants get fully separate identities.

## 7. Background processing

- **Transactional outbox** (`public.outbox_events`, `control.outbox_events`). Rows are written inside the same transaction as the change. The dispatcher (Trigger.dev scheduled task, every 10–30 s, `FOR UPDATE SKIP LOCKED` batches) fans events out to handlers. Each handler is idempotent.
- **Cron** (Supabase Cron / pg_cron):

| Every | Job |
|---|---|
| 1 min | `private.close_expired_attempts()` |
| 5–15 min | Leaderboard snapshots |
| Hourly | Enrollment expiry |
| Daily | Partition maintenance (`private.ensure_monthly_partitions`), installment reminders, usage roll-up to the control plane |

- **Heavy work** (Trigger.dev tasks): video ingestion callbacks, certificate and invoice PDFs, bulk imports, exports, notification fan-out, badge rule evaluation, question statistics, search indexing.

## 8. Realtime

Supabase Realtime **Broadcast** on private channels, authorized by RLS on `realtime.messages`:

- `tenant:{id}:member:{memberId}` – notifications, badge toasts
- `tenant:{id}:live:{sessionId}` – class started, polls
- `tenant:{id}:lb:{key}` – leaderboard ticks

Workers broadcast after commit. Avoid `postgres_changes` on hot tables at scale.

## 9. Why not … ?

| Alternative | Reason not chosen (now) |
|---|---|
| Schema-per-tenant | Migrations multiply, connection pooling suffers, cross-tenant analytics gets hard. The pooled + dedicated hybrid covers the same needs |
| A separate API service (NestJS/Go) | Not needed yet. The domain lives in `packages/core`, so it can be lifted into a service later without rewriting business logic |
| Prisma | Weak fit for RLS (the connection runs as one DB role) and slow in serverless. The SQL in `plan/database` is the source of truth |
| Firebase | No relational integrity or RLS-grade multi-tenancy for this domain |
| Building video conferencing | Commodity. Integrate providers instead |

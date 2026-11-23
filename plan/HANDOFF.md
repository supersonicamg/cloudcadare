# HANDOFF: where this project stands

> For the next session (human or AI). Read this first, then [README.md](README.md).
> Last updated: 2026-11-23

## 1. Status

| Area | State |
|---|---|
| Planning docs (`plan/01…13`) | ✅ Complete (vision, architecture, tenancy, toggles, frontend customization, modules, security, data, integrations, API/events, devops, roadmap, decisions) |
| Database SQL (`plan/database/*.sql`, 15 migrations) | ✅ Written **and verified** on Supabase Postgres 17.11 via `plan/database/tests/run_local.sh`: smoke test passes, 7 lints at 0 findings |
| App code | ❌ Not started. The repo root is still the default Next.js 16.4.6 scaffold (`app/`, `package.json`) |
| Git | ❌ The `plan/` folder is **not committed yet** (branch `main`, only the initial commit). Commit it first: `git checkout -b plan/initial && git add plan && git commit` |
| Client answers | ❌ Pending: see [13 §C/§D](13-decisions-and-open-questions.md) |

## 2. Decisions the owner still has to make (they block some work)

1. Platform brand name and base domain. The placeholders are **EduCore** and `yourplatform.app`; the domain is in `database/99_seed_catalog.sql` (`platform_settings.base_domain`).
2. Resellers in year 1, or platform-only? This decides how early Phase 4 is needed.
3. Hosting: Vercel (recommended) vs AWS/Cloudflare.
4. The second vertical after cloud training (NEET/JEE, K-12 or UPSC).
5. CloudCadre specifics (19 questions in doc 13 §C): Razorpay/GST, video volume and DRM, Zoom/Meet, labs provider, domain, brand assets, whether any learners are under 18, content migration.

## 3. Remaining work, in order (from [12-roadmap.md](12-roadmap.md))

### Phase 0: Foundation (next thing to do)

1. Convert the repo into a **Turborepo + pnpm monorepo** (layout in [02 §2](02-system-architecture.md)). The current root app becomes `apps/academy`.
2. Create the Supabase projects (local via `supabase init/start`, plus staging and prod, region `ap-south-1`). Copy `plan/database/*.sql` into `packages/db/supabase/migrations/` with timestamp prefixes.
3. Turn `tests/smoke_test.sql` into pgTAP tests. Add `tests/lint.sql` as a CI gate.
4. Build the packages: `tenancy` (host → tenant via Redis, `getTenantContext`), `auth` (supabase clients: user-scoped vs privileged), `features` (`isEnabled`/`requireFeature`), `permissions` (`can`), `ui` (tokens → CSS variables, Tailwind v4, shadcn).
5. Add `proxy.ts` (Next 16's name for middleware), an `app/[tenant]/layout.tsx` root that uses `next/root-params`, and the `default` theme shell.
6. Auth: phone/email OTP, the auth bridge for custom domains, staff MFA.
7. Console skeleton plus the license-key flow at `start.` (`control.redeem_license` → `control.provision_local`).
8. CI pipeline and Sentry.

**Phase 0 is done when:** creating a key → redeeming it → `demo.yourplatform.app` is live with branding, the admin can log in, and the isolation tests pass.

### Later phases

- **Phase 1: CloudCadre MVP.** Branding/CMS, courses and content (Mux), Razorpay checkout and fulfilment, progress, tests, gamification, certificates, email, `aurora` theme, custom domain.
- **Phase 2:** batches, live classes and attendance, faculty syllabus tracking, instructor portal, assignments, doubts, installments, WhatsApp/SMS/push.
- **Phase 3:** advanced tests, question import, offline fees, branches, parent portal, CRM, other verticals and themes.
- **Phase 4:** resellers, platform billing, dedicated data planes, custom frontend zones, public API, SSO.

## 4. Rules to follow when implementing

- **Next.js 16.4.6 differs from older versions.** Read `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`). Key points:
  - `proxy.ts`, not `middleware.ts`.
  - `next/root-params` works only in Server Components; in server actions and route handlers, resolve the tenant from the host header.
  - Cache Components: `'use cache'` + `cacheTag`; use `updateTag` in server actions and `revalidateTag` elsewhere.
  - `cacheComponents` needs `generateStaticParams` with at least one value for `[tenant]`.
- **Every feature must stay toggleable** (two layers: entitlement AND module setting). Never write `if (tenant === 'x')` branches.
- Business logic lives only in `packages/core`. Themes and custom apps are presentation only.
- The `anon` role gets no DB grants. Sensitive writes go only through RPCs or the privileged server path.
- After **any** schema change, run `./plan/database/tests/run_local.sh` (podman; image `public.ecr.aws/supabase/postgres:17.11.0.011` is cached locally). It must end with `ALL SMOKE TESTS PASSED` and all lints at `(0 rows)`.

## 5. How to resume in a new chat

Say something like: *"Read plan/HANDOFF.md and start Phase 0 step 1"*, or *"answer the open decisions with me first"*.

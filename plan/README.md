# EduCore Platform — End-to-End Plan

> Working codename **EduCore** (rename freely). First customer: **CloudCadre** (cloud training academy: AWS, Azure, FinOps, GreenOps…).
> Goal: a **white-label, multi-tenant, feature-toggled academy platform** you can sell to any institute (cloud training, NEET/JEE, UPSC, K-12 tuition, skill institutes). Each one gets its own branding, domain, modules and, if needed, a fully custom frontend. All of them run on one core.

This folder is the planning package. No application code has been written yet; the Next.js app in the repo root is still the default scaffold.

## Reading order

| # | Document | What it answers |
|---|----------|-----------------|
| 01 | [Product vision & scope](01-product-vision.md) | Who uses it, hierarchy, verticals, glossary, what's in/out |
| 02 | [System architecture](02-system-architecture.md) | Stack, monorepo layout, request lifecycle, caching, jobs |
| 03 | [Distribution & multi-tenancy](03-distribution-and-tenancy.md) | Distributor → license key → academy → users; domains; pooled vs dedicated DBs |
| 04 | [Feature toggles & plans](04-feature-toggles-and-plans.md) | Module catalog, entitlement resolution, limits, how code checks a feature |
| 05 | [Frontend customization](05-frontend-customization.md) | **Different UI/UX per client**: tokens → CMS blocks → themes → custom apps |
| 06 | [Functional modules](06-functional-modules.md) | Every module in detail: LMS, batches, live, tests, gamification, commerce, CRM… |
| 07 | [Security, auth & RBAC](07-security-auth-rbac.md) | Auth flows, roles/permissions, RLS model, content protection, DPDP compliance |
| 08 | [Data model & performance](08-data-model-and-performance.md) | ER map, conventions, indexing, partitioning, scaling path & numbers |
| 09 | [Integrations](09-integrations.md) | Payments, video, live classes, SMS/WhatsApp/email, storage: adapters |
| 10 | [API, events & jobs](10-api-events-jobs.md) | DAL, server actions, REST v1, outbox event catalog, cron jobs, webhooks |
| 11 | [DevOps & quality](11-devops-quality.md) | Environments, CI/CD, migrations across many DBs, testing, observability, DR |
| 12 | [Roadmap](12-roadmap.md) | Phased delivery with exit criteria, CloudCadre MVP first |
| 13 | [Decisions & open questions](13-decisions-and-open-questions.md) | ADR log + questions to ask the client |
| 14 | [Delivery and hosting](14-delivery-and-hosting.md) | One Supabase project per client, Vercel then the owner's VPS, per-client checklist |
| 15 | [Design and UX guide](15-design-and-ux-guide.md) | **Read before any UI work.** CloudCadre look and feel: banned tropes, surfaces, colour, type, components, diagrams, page recipes. Reference build: `mockups/homepage-v9.html` |
| DB | [database/](database/README.md) | **Executable SQL** (15 migrations, ~5k lines), smoke tests, lints |

## The design in one page

```
                 ┌──────────────────────────────────────────────────────────┐
  YOU ─────────▶ │ CONTROL PLANE  (schema: control, console app)            │
 (platform       │ distributors (tree) · plans · features · add-ons         │
  distributor)   │ license keys · tenants · domains · subscriptions         │
  resellers ───▶ │ entitlements · usage · invoices · impersonation · audit  │
                 └──────────────┬───────────────────────────────────────────┘
                                │ sync: tenant + resolved entitlements
             ┌──────────────────┴───────────────────┐
             ▼                                      ▼
  ┌───────────────────────────┐        ┌───────────────────────────┐
  │ POOLED DATA PLANE          │        │ DEDICATED DATA PLANE       │
  │ 1 Supabase project, N      │        │ 1 Supabase project per     │
  │ academies, isolated by RLS │        │ enterprise academy (silo)  │
  │ (same migrations)          │        │ (same migrations)          │
  └─────────────┬─────────────┘        └─────────────┬─────────────┘
                └───────────────┬────────────────────┘
                                ▼
   academy.com / slug.yourplatform.app  ──▶  proxy.ts resolves Host → tenant
                                ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ FRONTENDS (all use the same @core packages)                       │
   │ apps/academy  – shared multi-tenant app, theme chosen per tenant  │
   │ apps/web-<client> – fully custom learner site for one client      │
   │ apps/console  – distributor console                               │
   └───────────────────────────────────────────────────────────────────┘
```

**Eight decisions everything else follows from** (details in [13](13-decisions-and-open-questions.md)):

1. **Control plane ≠ data plane.** Distributor data (plans, licenses, billing) is separate from academy data. Academies get a *projection* of their entitlements.
2. **Pooled by default, dedicated on demand.** Every table carries `tenant_id`, keys are UUIDv7 and FKs are composite `(tenant_id, id)`. The same migrations run on a shared database or on a tenant's own database, and a tenant can move between them.
3. **Isolation is enforced in Postgres.** RLS everywhere with default-deny grants. The `anon` role gets nothing. Answer keys, payments, grades and progress are written only through validated RPCs or server code.
4. **Feature toggles have two layers.** What the academy **bought** (entitlement, set by the distributor) is checked first, then what the academy **switched on** (module setting, set by the academy admin). Both are checked in UI, server and DB.
5. **One flexible content model.** A course is a nestable tree of sections (Phase › Month › Week) containing typed lessons. `courses.kind` covers courses, study-material packs, test series and live programs, so one model fits cloud academies, NEET coaching and PDF sellers alike.
6. **Headless core, swappable skins.** Business logic lives in packages. Each frontend is a skin chosen from four levels: design tokens, CMS blocks, theme packages, or a fully custom app (multi-zones).
7. **Events over coupling.** State changes write to a transactional outbox. Notifications, badges, webhooks, analytics and search all react asynchronously.
8. **India-first, global-ready.** Supported from day one: INR/GST, Razorpay, DLT SMS, WhatsApp, phone OTP (deferred for now, ADR-13), the DPDP Act (incl. minors), Mumbai region and Hindi/regional locales.

## Database status (verified)

The SQL in [database/](database/) was **applied and tested on Supabase Postgres 17.11** (`plan/database/tests/run_local.sh`):

- 15 migrations, 132 tables, 0 lint findings (RLS on every table, pinned `search_path`, no `anon` grants, every foreign key indexed).
- The smoke test covers license redemption, entitlement resolution (plan + add-on + override + dependency), cross-tenant isolation, RBAC, progress tracking, the test engine with negative marking, XP and streaks, leaderboards, faculty syllabus tracking, plan limits, the audit log and the outbox.

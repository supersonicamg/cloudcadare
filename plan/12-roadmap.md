# 12 · Roadmap

The order is chosen so that **CloudCadre goes live early on the real multi-tenant foundation**. No throw-away single-tenant version is built. Durations assume 2–3 full-stack engineers and are indicative.

## Phase 0 · Foundation (≈ 2 weeks)

- Monorepo (Turborepo, pnpm), packages skeleton, lint boundaries, CI pipeline.
- Supabase projects (local, staging, prod). Migrations from `plan/database` into `packages/db`. pgTAP + lint gates green.
- `proxy.ts` host resolution (Redis), `app/[tenant]` root with root params, tenancy, auth and features packages, design tokens → CSS variables, `default` theme shell.
- Auth: email + password (ADR-13), auth bridge, staff MFA.
- Console skeleton: platform login, distributor and tenant list, license key creation, redemption flow at `start.`, provisioning (pooled, local sync).
- Observability baseline (Sentry, logs with tenant tags).

**Exit:** create a license key → redeem → `demo.yourplatform.app` is live with branding, and an admin can log in. Isolation tests pass.

## Phase 1 · CloudCadre MVP (≈ 6–8 weeks)

- Admin: branding (L1), CMS homepage blocks (L2, core block set), navigation, people & roles, invitations, import.
- Catalog & content: courses (all kinds), nested sections, lessons (video via Mux, PDF/doc, article, external/embed), media library, free previews, sequential and drip unlock.
- Commerce: products and bundles, prices, coupons, Razorpay checkout (tenant's own keys), webhook fulfilment, GST invoice PDF, orders and payments screens.
- Learning: player with heartbeats, progress, course completion, learner dashboard, notes.
- Assessments v1: question bank (objective types), quizzes and tests with timer, test engine RPCs, results.
- Gamification v1: XP, levels, badges (rule worker), weekly and all-time leaderboards, streaks.
- Certificates with a public verification page.
- Notifications: in-app + email (Resend), core templates.
- Theme `aurora` (CloudCadre look). Custom domain for CloudCadre.
- Console: plans, features matrix, overrides, tenant 360° (basic), impersonation.

**Exit:** CloudCadre sells a course online, learners complete it with progress, XP, tests and a certificate, and the admin runs everything without your help. Load test: 2k concurrent learners.

## Phase 2 · Cohorts, live & faculty (≈ 5–6 weeks)

- Batches (timetable, faculty, per-batch release), live classes (Zoom/Meet adapters, reminders, recordings), attendance (auto, manual, QR).
- **Syllabus plans and coverage, with plan-vs-actual dashboards per faculty and batch.**
- Instructor portal (my batches, schedule, coverage, grading queue, doubts).
- Assignments with grading. Discussions and doubts with SLA.
- Installments with reminders. Push notifications (PWA). WhatsApp and SMS (MSG91 DLT) for Pro.
- At-risk learners, coordinator dashboard, exports.

**Exit:** a cohort runs end to end with live classes, attendance, syllabus tracking and graded work. The coordinator sees faculty variance.

## Phase 3 · Multi-vertical depth (≈ 6 weeks)

- Advanced tests: sections and sectional timing, random pools, negative and partial marking, ranks and percentiles, topic analytics, item analysis, basic proctoring. Test-series product with schedule.
- Question import (Word/Excel), translations (Hindi), subjective grading for UPSC answer writing.
- Offline fee collection and receipts, branches, parent portal with guardian consent (DPDP minors), custom fields and custom roles.
- CRM: leads, forms, pipeline, demo bookings, conversion.
- Vertical presets polished (NEET/JEE, UPSC, K-12). Second and third themes (`minimal`, a coaching-style theme).
- Second customer onboarded from a different vertical, as proof of the "general structure".

**Exit:** a NEET coaching institute and a K-12 tuition centre run on the same platform with different modules, terminology and look.

## Phase 4 · Distribution scale (≈ 4–6 weeks)

- Reseller distributors (subtree console, own plans, commissions), platform billing with Razorpay Subscriptions, usage metering → invoices.
- Dedicated data planes (Supabase Management API provisioning, migration fan-out, move-tenant job), signed entitlements for self-hosted deliveries.
- **Custom app zones (L4):** generator, `apps/web-cloudcadre` if CloudCadre wants a bespoke experience, contract test suite.
- REST v1 public with API keys, outbound webhooks, SSO (Google Workspace / SAML).
- Warehouse CDC for analytics, read replica for reports.

**Exit:** a reseller onboards their own academy with a key, a dedicated-plane tenant runs, and a custom zone serves one client's domain.

## Phase 5 · Growth (ongoing)

- Expo mobile app (branded per tenant via EAS build profiles), offline downloads with DRM.
- AI: doubt assistant (RAG on tenant content), question generator, recording summaries.
- SCORM/LTI, lab provider integrations, marketplace ideas, more languages.

## Milestone checklist for "production ready"

- [ ] RLS matrix tests for 100% of tables; external pen test passed.
- [ ] Backups and a restore drill (whole plane + single tenant) documented.
- [ ] SLO dashboards, on-call, status page.
- [ ] DPDP: privacy policy, DPA template, consent flows, DSR handling, minors flow.
- [ ] Legal pages per tenant (terms, privacy, refund) with templates.
- [ ] Payment reconciliation job live; webhook dead-letter alerting.
- [ ] Load tests at 2× expected peak (exam day).
- [ ] Runbooks 1–8 written ([11 §6](11-devops-quality.md)).

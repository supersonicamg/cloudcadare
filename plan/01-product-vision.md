# 01 · Product Vision & Scope

## 1. Problem

Indian academies and coaching institutes (cloud training, NEET/JEE, UPSC, school tuition, skill centres) need the same core things:

- a branded website to sell from
- a way to deliver content (videos, PDFs, live classes)
- a way to run tests
- a way to track learners and faculty
- a way to collect fees

Today they stitch together WhatsApp groups, Google Drive, Zoom, Google Forms, spreadsheets and a generic payment link. Off-the-shelf platforms are either rigid (one UI for everyone, everything bundled) or too expensive for small institutes.

**EduCore** is one core platform you, as the **distributor**, resell:

- **White-label:** each academy has its own name, logo, colours, domain and, optionally, its own fully custom UI.
- **Modular:** every feature is a toggle. A "PDF seller" pays for a small plan and never sees test series or CRM. A large coaching chain gets everything.
- **Vertical-aware:** terminology, defaults and seed data adapt per industry ("Track/Cohort/Mentor" for cloud training, "Course/Batch/Faculty/Lecture" for NEET, "Aspirant" for UPSC).
- **Scalable & safe:** pooled hosting for small academies, a dedicated database for enterprise clients, and the same code for both.

## 2. Actors & hierarchy

```
Platform owner (you)                    ← root distributor (kind = platform)
 └── Reseller / partner distributors    ← optional sub-distributors with their own plans & commission
      └── Tenant = Academy / Institute  ← redeems a license key, gets domain + DB space
           ├── Branches / centres       ← optional (org.branches)
           ├── Staff: owner, admin, academic coordinator, instructor/faculty,
           │          teaching assistant, content creator, counsellor, accountant, custom roles
           ├── Learners: students / aspirants
           └── Guardians: parents (org.parent_portal)
```

| Actor | Lives in | Main surfaces |
|---|---|---|
| Platform staff | `control.distributor_members` (platform node) | Distributor console: everything, all tenants |
| Reseller staff | `control.distributor_members` (reseller node) | Console limited to their subtree |
| Academy staff | `public.tenant_members` + roles | Academy admin, instructor portal |
| Learner | `public.tenant_members` (student role) | Public site, learner app (web/PWA/mobile) |
| Guardian | `public.tenant_members` (guardian role) + `guardian_links` | Parent view: progress, attendance, results, fees |

A single human (one login) can be a student at academy A and a faculty member at academy B. They have two member profiles, and each academy only ever sees its own.

## 3. Verticals (industry presets)

A vertical is applied when the tenant is provisioned (`control.vertical_templates`). It sets terminology, which modules start off, default settings such as negative marking, and seed levels and badges.

| Vertical | Typical modules | Notable defaults |
|---|---|---|
| `cloud_training` (CloudCadre) | Courses as "tracks", phases/months, labs, mock certification exams, mentors, cohorts, certificates, XP & levels (Explorer → Architect), leaderboards | Sequential unlock, 90% completion threshold, no negative marking |
| `neet_jee` | Batches, live classes, attendance, test series with sections and negative marking, ranks/percentiles, doubts, parent portal, installments, offline fees | +4/−1 marking, mock-test badges |
| `upsc` | Test series, answer-writing assignments (subjective grading), current-affairs material packs, mentorship | 2 marks/−0.33 |
| `k12_tuition` | Classes = batches, attendance, parent portal, fees, homework | Minor-safe defaults (anonymized leaderboards, guardian consent) |
| `skill_dev` | Self-paced courses, certificates, reviews, affiliates | — |
| `generic` | Neutral | — |

## 4. Scope

### In scope (platform)

- Distributor console: tenants, license keys, plans, add-ons, feature matrix, overrides, domains, usage, billing, impersonation, announcements, audit.
- Academy admin: branding, website builder, modules, people and roles, catalog, content, batches, live, tests, gamification, commerce, CRM, reports, integrations.
- Instructor portal: my batches, schedule, syllabus coverage, attendance, grading queue, doubts, learner progress.
- Learner app: discover → buy → learn → test → progress, XP and leaderboard → certificate.
- Guardian view.
- Public website per academy (CMS blocks, SEO, blog, results showcase, lead forms).
- Integrations: Razorpay/Stripe, Mux/Bunny/VdoCipher, Zoom/Meet, MSG91, WhatsApp, Resend/SES, web push.
- Public API and webhooks for academies on the higher plans.

### Explicitly later

- Native mobile apps (Expo); the PWA comes first.
- AI assistant and question generation (feature flags are reserved).
- SCORM/LTI and third-party lab provisioning (the lesson types are reserved).
- A marketplace across academies.
- Video conferencing built in-house (we integrate providers instead).

### Non-goals

- Becoming the merchant of record for academies' sales. Each academy collects into its **own** gateway account. The platform bills academies separately.
- Hosting video files in Supabase Storage. Video goes to a video platform.

## 5. Key user journeys

1. **Academy onboarding:**
   - The distributor creates a license key (plan, vertical, term) and sends it to the customer.
   - The customer opens `start.yourplatform.app`, signs up and enters the key, academy name and slug.
   - `slug.yourplatform.app` is live within seconds with a branded starter site.
   - Later the customer can add a custom domain.
2. **Learner purchase:** home → course page → checkout (coupon, installments) → payment → enrollment(s) created → welcome email/WhatsApp → dashboard.
3. **Learning loop:**
   - The curriculum shows locked/unlocked items (drip and sequential rules).
   - Progress is saved by heartbeats, and XP and the streak update.
   - Tests use a server-timed engine with results and analytics.
   - Badges and levels are awarded, and the certificate is issued at completion.
4. **Faculty loop:** the coordinator creates a batch and its syllabus plan (Month 1: topics with dates) → faculty run live classes and mark attendance → faculty log coverage → the dashboard shows *expected vs actual* syllabus progress per faculty and batch → learners' progress is shown against it.
5. **Fee loop (coaching):** installment plan → reminders (WhatsApp/SMS/email) → online or offline payment recorded by the accountant → GST invoice → guardian sees dues.
6. **Distributor loop:** monitor tenants (usage vs limits, MRR, health) → upsell an add-on or upgrade the plan (entitlements re-sync instantly) → suspend for non-payment (the academy sees a banner and becomes read-only) → impersonate for support (time-boxed, audited).

## 6. Glossary

| Term | Meaning |
|---|---|
| **Distributor** | A node in the reseller tree. You are the root ("platform"). |
| **Tenant / Academy** | One customer organisation. Has a slug, domains, branding and data. |
| **Control plane** | Distributor-level database schema and console. |
| **Data plane** | Where academy data lives (pooled or dedicated Supabase project). |
| **Feature** | A toggleable capability with a stable key, e.g. `engage.leaderboards`. |
| **Entitlement** | The resolved "is this feature bought, and with what limit" for a tenant. |
| **Module setting** | The tenant admin's on/off switch for an entitled feature. |
| **Vertical** | Industry preset (terminology, defaults, seed data). |
| **Theme / Frontend template** | The UI skin package, or a custom app serving a tenant. |
| **Member** | A person's profile inside one tenant. |
| **Course (kind)** | `course`, `material_pack`, `test_series` or `live_program`. |
| **Section** | A nestable curriculum node labelled by the academy (Phase/Month/Week/Unit/Chapter). |
| **Lesson** | A typed learning item: video, pdf, live, quiz, test, assignment, lab… |
| **Batch** | A scheduled cohort with learners, faculty, timetable and a syllabus plan. |
| **Syllabus plan** | Faculty's planned coverage items with target dates, compared with logged coverage. |
| **Product** | What's sold: a course, bundle, batch seat, test series, material pack or subscription. |
| **Outbox event** | A domain event written in the same transaction as a change, processed asynchronously. |

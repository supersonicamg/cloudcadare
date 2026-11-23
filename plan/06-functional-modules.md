# 06 · Functional Modules

Each module lists its **feature key(s)**, **tables** (see `database/`), **rules** and **screens**. ★ marks capabilities that were *not* in the original brief but are standard for production academies. They are included so you don't have to retrofit them later.

---

## M1 · People, roles & organisation (`core.*`, `org.*`)

**Tables:** `tenant_members`, `roles`, `role_permissions`, `member_roles`, `permission_catalog`, `invitations`, `guardian_links`, `instructor_profiles`, `custom_field_definitions`, `branches`, `member_devices`, `consents`, `data_subject_requests`

- **Seeded roles:** owner, admin, academic coordinator, instructor/faculty, teaching assistant, content creator, counsellor, accountant, student, guardian. With `org.custom_roles`, academies can create their own roles from the permission catalog.
- **Scoped grants:** a role can apply tenant-wide or only to a **branch / batch / course** (`member_roles.scope_type`). Examples: a faculty member who only sees batch "SAA-NOV"; a counsellor limited to the Pune branch.
- **Member code** (roll/enrollment number) generated from `tenant_counters` with a pattern such as `CC-2026-00042`.
- **Ways to join:**
  - Signup on the site (if `auth.open_signup`).
  - Invitation (email/phone, token).
  - Bulk CSV import (`import_jobs` with a validation report).
  - Created by an admin.
  - Created by an offline admission in the fee module.
- ★ **Custom fields** per entity (member, course, enrollment, lead, order, batch). Values are JSONB validated against definitions. Visibility is staff, self or public.
- ★ **Guardians:** link parent ↔ student with granular permissions (progress, attendance, results, payments), guardian-only notifications and a consent flow for minors.
- ★ **Device limits:** max N concurrent devices per learner. The oldest session is revoked, and the learner sees "logged out on other device". This is anti account-sharing, critical for paid content in India.
- **Screens:** People list (filters: role, batch, course, status, branch, custom fields), member 360° (profile, enrollments, progress, attendance, results, payments, devices, notes, audit), Roles editor, Invitations, Import wizard.

## M2 · Catalog & content (`catalog.*`, `content.*`)

**Tables:** `courses`, `course_instructors`, `course_sections`, `lessons`, `lesson_resources`, `media_assets`, `taxonomy_terms`

- **Course kinds:**
  - `course`: structured with progress.
  - `material_pack`: downloads only, no gating; the cheap "study material distribution" plan.
  - `test_series`: lessons are tests.
  - `live_program`: lessons are live sessions plus recordings.
- **Curriculum:** nested `course_sections` (any depth) labelled by the academy (Phase › Month › Week, Unit › Chapter, or Module), with typed `lessons`:

  | Lesson type | Delivery | Completion rule default |
  |---|---|---|
  | video / audio | Provider HLS with signed playback, resume, speed, captions, watermark | `watch_pct` 90% |
  | pdf / document / image / download | Signed URL, inline viewer, optional download | `view` |
  | article | Rich text (Tiptap JSON), code blocks, LaTeX | `view` |
  | live | Linked live session (join → recording) | attendance (`manual`/auto) |
  | quiz / test | Test engine | `pass_test` |
  | assignment | Submission + grading | `submit_assignment` |
  | external_link / embed | YouTube unlisted, Google Slides, CodePen, Figma… | `view` / `manual` |
  | lab ★ | External sandbox (AWS/Azure lab provider, Killercoda, Instruqt); config in `embed` | `manual` / provider callback |
  | scorm ★ | SCORM 1.2/2004 player (later) | SCORM status |

- **Unlock rules** (`unlock_rule` on section or lesson):
  - `always`
  - `date` (absolute)
  - `relative` (N days after enrollment), the classic drip
  - `after` (prerequisite lessons, optional minimum score)
  - `batch_release` (faculty releases per batch via `batch_content_releases`)
  - plus the course-level `settings.sequential`

  Evaluated server-side in `@core/content.getCurriculumForLearner()`, which returns each item with `{locked, reason, unlocks_at}`. Content endpoints refuse locked items.
- **Free previews:** `lessons.is_preview` makes a lesson viewable without enrollment (marketing).
- **Taxonomy:** one tree for categories, exams, subjects, topics, skills and chapters. It drives catalog filters, question-bank tagging and analytics ("weak topics").
- ★ **Reviews & ratings** (`catalog.reviews`): only enrolled learners can review; there is a moderation queue and an academy reply.
- ★ **Course versioning rule:** editing a published course is live. Structural deletes are soft (`deleted_at`) so learners' progress history stays intact. Progress % is recomputed against currently published mandatory lessons.
- **Screens:**
  - Admin: course builder (drag-and-drop tree, lesson editors, bulk upload, preview as learner), media library (upload, transcoding status, usage), taxonomy manager.
  - Learner: catalog, course page, player.

## M3 · Enrollment & access

**Tables:** `enrollments`, `products`, `product_items`

- Access = an active enrollment (`status in active|completed`, not expired). Granted by purchase, admin, bundle, subscription, free signup, coupon or import.
- `expires_at` comes from the product or `course.access_duration_days`. The hourly job expires access and notifies the learner 7 days, 1 day and 0 days before ("Renew access").
- A bundle purchase → one enrollment per course in `product_items` (recursively through child products).
- A batch-seat purchase → enrollment with `batch_id`, plus all of the batch's courses.
- **Pause/resume** (medical leave), **transfer batch** and **extend access** are admin actions, audited.
- **Displays "days since enrolled", days remaining, active days and days since last activity** (`v_enrollment_overview`). These answer the brief's "how many days/months enrolled" requirement and feed at-risk alerts.

## M4 · Progress tracking (`learning.progress`)

**Tables:** `lesson_progress`, `daily_activity`, `learning_events` (partitioned), `member_stats`

- The client calls `record_lesson_progress(lesson, position, delta, pct, mark_complete)` every 15 s while playing and on page hide. The server:
  - validates membership, enrollment, publication and the completion rule
  - **caps the time delta at 120 s per call** (no farming)
  - upserts progress and recomputes the course % (mandatory lessons only)
  - marks the course complete at the threshold
  - writes the event and outbox rows, awards XP and updates the streak in the tenant's timezone
- **Learner dashboard:**
  - continue learning (last lesson)
  - per-course progress
  - streak and heatmap
  - weekly time spent
  - upcoming live classes and tests
  - pending assignments
  - XP/level/rank
- **Staff views:**
  - course funnel (enrolled → started → 25/50/75/100%)
  - lesson drop-off
  - learner table (progress, last active, scores)
  - ★ **at-risk learners**: no activity for 7+ days, progress behind the batch median, or failing tests. These trigger nudges via the notification rules.
- **Notes & bookmarks** (`learning.notes`): timestamped notes on videos and page notes on PDFs, exportable.

## M5 · Batches / cohorts & faculty syllabus tracking (`cohort.*`)

**Tables:** `batches`, `batch_courses`, `batch_instructors`, `batch_content_releases`, `syllabus_plans`, `syllabus_items`, `syllabus_coverage`; views `v_syllabus_item_status`, `v_instructor_syllabus_progress`

This module answers the brief's "what is the instructor's progress" requirement, as follows.

1. The coordinator creates a batch (dates, mode, branch, capacity, timetable RRULE) and attaches its courses and faculty (per subject).
2. **Syllabus plan per batch × course:** items such as "IAM deep dive", with a phase label ("Month 1"), planned start/end dates, a responsible faculty member and a weight. Items can be generated from the course tree ("one item per section, spread over N weeks") and then adjusted.
3. Faculty **log coverage** after each class (cumulative %, optionally linked to the live session), in one tap from the class card.
4. **Plan vs actual (verified in the smoke test):**
   - per item: `completed / in_progress / due / delayed / upcoming` and days late
   - per faculty × batch: `expected_pct` (should be covered by today), `actual_pct` (weighted coverage) and `schedule_variance_pct`
5. Alerts go to the coordinator when variance is below −10% or items are delayed by more than 7 days, and the weekly digest goes to the owner.
6. **Learner side:** a "syllabus timeline" (what's covered, what's next), and learner progress shown *relative to coverage* ("Faculty covered 60%, you've completed 45%").
7. ★ **Timetable:** recurring schedule → generates `live_sessions` occurrences (series), with conflict checks for faculty and rooms.

## M6 · Live classes & attendance (`live.*`)

**Tables:** `live_sessions`, `live_session_hosts` (host links kept separate from learners), `attendance_records`

- **Providers via adapter:** Zoom (Server-to-Server OAuth, create meeting, participants report), Google Meet (Calendar API), MS Teams (Graph), 100ms (in-app SDK), YouTube Live (webinar), custom link, in-person.
- **Join flow:** the button activates 10 minutes before start. The learner's join is logged (`learning_events`) and the redirect goes to the provider. With Zoom/100ms, attendance is pulled from the provider report after the class (join/leave, duration). Present if duration ≥ X% of the class, as configured per tenant.
- **Manual and QR attendance** for offline and hybrid classes: the faculty screen shows a rotating QR code, which the learner scans in the PWA.
- **Recordings:** the provider webhook → ingest to the video provider → attach as `recording_media_id` → appears in the lesson. "Recording available" notification.
- **Reminders:** 24 h and 15 min before (push/WhatsApp/email per preference).
- **Reports:** attendance % per learner/batch/subject, defaulters list, export, guardian view.

## M7 · Assessments (`assess.*`, `catalog.test_series`)

**Tables:** `questions`, `question_keys` (never readable by learners), `question_stats`, `tests`, `test_sections`, `test_questions`, `test_attempts`, `attempt_answers`, `assignments`, `assignment_submissions`

- **Question bank:**
  - Types: MCQ single/multi, true/false, numeric (with tolerance), fill-blank, match, ordering, assertion-reason, passage (comprehension with children), subjective, code.
  - Rich stems (LaTeX, images), translations (`hi`), difficulty 1–5, subject/topic tags, PYQ year.
  - Review workflow: draft → review → approved.
  - Bulk import from Word/Excel (template), with an image extraction worker.
- **Tests:**
  - Kinds: quiz, practice, mock, sectional, exam, diagnostic, survey.
  - Duration (global or per section), availability window, attempts limit, shuffling.
  - Negative marking with marks at question, section or test level.
  - **Random pools per section** (count + filter by subject, topic, difficulty, tags).
  - Result visibility: immediate, after close, manual or never. Answer/solution visibility is set separately.
  - Pass marks.
- **Engine integrity (implemented in SQL):**
  - `start_test_attempt` builds a **paper snapshot** (question order + marks per attempt) and a **server deadline**.
  - `get_attempt_paper` returns content **without keys**, and shuffles options deterministically per attempt.
  - `save_attempt_answer` autosaves. It rejects answers after deadline + grace and questions not in the paper, and caps the payload size.
  - `submit_test_attempt` → `grade_attempt` auto-grades objective types, including negative and partial marking. Subjective answers go to a grading queue.
  - `close_expired_attempts` (cron) auto-submits abandoned attempts.
- **Results & analytics:**
  - score, %, correct/incorrect/unattempted, time per question
  - **rank & percentile** (`compute_test_ranks` on best attempts)
  - topic-wise strengths and weaknesses
  - comparison with the topper and the average
  - solutions with explanations
  - ★ item analysis (`question_stats`: difficulty index, discrimination) to improve the bank
- ★ **Proctoring (basic):** fullscreen enforcement, tab-switch/blur counter (`proctor_flags`), copy/paste block, optional webcam snapshot (later). This is not anti-cheat-proof, and is honestly positioned as a deterrent.
- **Assignments:**
  - Text/file/URL/code submissions to the `submissions` bucket, due dates, late policy, multiple attempts.
  - Rubric grading, inline feedback, returned-for-revision.
  - ★ Answer-writing practice for UPSC (subjective, faculty annotations on PDF).
- **Test series product:** a `test_series` course whose lessons are tests, sold like any product, with a schedule ("Test 5 opens on 12 Jan").

## M8 · Gamification (`engage.gamification|badges|leaderboards|streaks`)

**Tables:** `xp_ledger` (append-only, idempotent), `member_stats`, `levels`, `badges`, `member_badges`, `leaderboards`, `leaderboard_entries`

- **XP sources (configurable per tenant):**
  - lesson completion (`lessons.xp_points`)
  - course completion (default 100)
  - passed test (default 50)
  - badge rewards
  - streak milestones
  - accepted doubt answers
  - manual awards by staff, with a reason
- **Levels:** tenant-defined thresholds (seeded per vertical: "Cloud Explorer → Architect", "Aspirant → Topper"). The level is recomputed on every XP change.
- **Badges:** declarative criteria evaluated by the rules worker on outbox events, e.g.:
  - `{"event":"lesson.completed","count":10}`
  - `{"event":"test.graded","where":{"percentage_gte":90}}`
  - `{"metric":"current_streak","gte":30}`

  There are manual badges ("Best project"), secret badges and tiers.
- **Streaks:** consecutive active days in the tenant's timezone, with longest-streak tracking. ★ Optional "streak freeze" items later.
- **Leaderboards:**
  - scope: tenant, course, batch, branch or test
  - metric: XP, test score, streak, lessons completed or attendance %
  - period: daily, weekly, monthly or all time
  - top-N, public/private, **anonymize** (minors)

  Computed as snapshots (`refresh_leaderboard`) every 5–15 minutes, with "my rank" pinned. Live updates use the Redis ZSET when traffic needs it.
- Everything can be switched off per tenant, and some academies (e.g. K-12) may prefer it off.

## M9 · Certificates (`learning.certificates`)

- Template designer (background, positioned fields, QR code), issued on course completion (auto) or manually.
- Unique serial (`tenant_counters`) and a **public verification page** `/verify/{code}` showing the name, course, date and validity. Revocation is supported.
- PDF generated by a worker (react-pdf), shareable to LinkedIn ("Add to profile" URL).

## M10 · Communication (`engage.announcements`, `comms.*`, `core.notifications`)

**Tables:** `announcements`, `notifications`, `notification_templates`, `notification_preferences`, `push_subscriptions`, `message_deliveries`

- **Notification engine:**
  1. An outbox event → a rule maps it to an event key (`enrollment.created`, `live.reminder`, `test.result_published`, `installment.due`, `badge.awarded`, `doubt.answered`…).
  2. Recipients are resolved (learner, guardians, faculty).
  3. Channels are chosen from the tenant's entitled channels × the member's preferences × quiet hours.
  4. The template is rendered (tenant override → platform default, locale fallback) and sent through the provider adapters.
  5. The delivery is logged, which also feeds usage metering.
- **In-app inbox** with realtime badge counts. **Announcements** target an audience (all, roles, batches, courses, members), can be pinned and can expire.
- **India specifics:** SMS through DLT-registered templates (`provider_template_id`), WhatsApp templates approved by Meta, opt-in consent tracked in `consents`.
- ★ **Discussions & doubts** (`engage.discussions`, `engage.doubts`):
  - Course/batch/lesson threads, upvotes, accepted answers, moderation and reports.
  - Doubts go to a queue assigned to faculty, with an SLA timer (`sla_due_at`), image/LaTeX attachments and a "doubt answered" notification.
  - A faculty KPI covers response time.

## M11 · Commerce (`commerce.*`)

**Tables:** `products`, `product_items`, `prices`, `tax_rates`, `coupons`, `coupon_redemptions`, `orders`, `order_items`, `installments`, `payments`, `refunds`, `invoices`, `member_subscriptions`, `affiliates`, `affiliate_conversions`, `payment_gateway_accounts`, `gateway_webhook_inbox`

- **Products:** course, bundle (the brief's "multiple bundles"), batch seat, test series, material pack, subscription, live program. Each product can have multiple prices: one-time, 3-installment plan, monthly/annual subscription, with a compare-at (strike-through) price, sale windows and max seats.
- **Checkout:**
  1. Create the order (idempotency key) with price snapshots, the GST split (CGST+SGST intra-state or IGST inter-state from the place of supply) and the coupon.
  2. Create the gateway order and pay through Razorpay Checkout (UPI, cards, netbanking, EMI).
  3. The **webhook** is authoritative: verify the signature → dedupe in the inbox → mark the payment captured → mark the order paid → **fulfil** (create enrollments) → send the invoice and notifications.
  4. The client-side success callback only polls the order status.
- **Installments:** the plan generates `installments` with due dates. Reminders go out at −3/0/+3 days. Overdue installments can pause access per policy. Learners pay each installment online, or the accountant records offline payments (cash/UPI/cheque, with a receipt number and `received_by`).
- **Refunds:** full or partial through the gateway API. They can optionally revoke access, issue a credit note and reverse the affiliate commission.
- **GST invoices:** per-financial-year numbering (`INV/2026-27/000123`), seller/buyer snapshots, B2B GSTIN capture, PDF.
- **Learner subscriptions:** Razorpay/Stripe subscriptions for "all-access" products. Access lasts while the subscription is `active|trialing`.
- ★ **Affiliates & referrals:** affiliate codes and links (cookie 30 days), commission %, conversions → approval → payout report. ★ Faculty-specific coupons.
- **Money rule:** each academy connects **its own** gateway (keys stored in Vault). The platform never touches academy revenue. Platform billing of academies is separate, in the control plane.

## M12 · Website & CMS (`site.*`)

**Tables:** `site_pages`, `site_page_versions`, `site_navigation`, `blog_posts`, `showcase_items`, `faqs`, `tenant_branding`

- Block-based pages (see [05](05-frontend-customization.md)), header/footer menus, blog, results/toppers showcase, testimonials, FAQs, per-page SEO.
- **Auto-generated pages:** catalog, course detail, bundle, faculty list and profile, batch schedule, certificate verification, legal (terms, privacy, refund).
- **SEO:**
  - per-tenant `sitemap.xml` and `robots.txt` (dynamic route handlers)
  - canonical domain, Open Graph images (generated per course with `ImageResponse`)
  - JSON-LD (`Course`, `Organization`, `FAQPage`, `BreadcrumbList`)
  - hreflang for multi-language
- ★ **Lead capture forms** on any page → `leads` (Turnstile-protected).

## M13 · CRM & admissions (`crm.*`)

**Tables:** `leads`, `lead_activities`, `forms`, `form_submissions`

- **Sources:** website forms, WhatsApp click-to-chat, walk-in, phone, ads (UTM), import, demo-class booking.
- **Pipeline:** new → contacted → qualified → demo scheduled → negotiation → converted / lost, with an owner (counsellor), branch, follow-up reminders and an activity timeline (calls, notes, WhatsApp).
- **Convert lead → member + order** in one step (offline admission). Conversion analytics by source and counsellor.

## M14 · Analytics & reports (`analytics.*`)

| Persona | Dashboards |
|---|---|
| Owner | Revenue (gross, refunds, net; by product), enrollments, active learners (DAU/WAU/MAU), completion rates, fee dues, lead conversion, faculty KPIs |
| Coordinator | Batch health: attendance %, syllabus variance, test averages, at-risk learners |
| Faculty | My batches, coverage vs plan, grading queue, doubt SLA, class attendance |
| Learner | Progress, streak, strengths and weaknesses, rank trend |
| Guardian | Attendance, test results, progress, dues |

- **Implementation:**
  - Phase 1: SQL views and materialized views refreshed by cron.
  - Phase 3+: CDC (logical replication) into a warehouse (ClickHouse/BigQuery) for heavy cohort and funnel analysis without loading the primary.
- **Exports** (`analytics.exports`): CSV/XLSX through a worker → `exports` bucket → signed link (expires in 24 h), audited.

## M15 · Integrations & developer platform (`integrations.*`)

- **REST API v1** with tenant API keys (scoped, hashed, rotatable) for academies that want to sync with their ERP or website.
- **Outbound webhooks** (signed HMAC, retries with backoff, delivery log, replay).
- **SSO:** Google Workspace / Microsoft Entra / SAML (Supabase SSO) for corporate cloud-training customers, a strong fit for CloudCadre's B2B deals.
- Zapier/Make via webhooks plus API keys.

## M16 · ★ Platform-level extras worth planning now

| Capability | Why |
|---|---|
| **PWA** (installable, offline shell, push) | Most Indian learners are mobile-first; the native app comes later |
| **Multi-language UI and content** | Hindi + regional; question translations already modelled |
| **Accessibility (WCAG 2.2 AA)** | Legal and ethical; built into `packages/ui` |
| **Content protection** | DRM add-on, watermark, device limits, signed short-lived URLs, no right-click/download where configured |
| **Support** | In-app help widget per tenant (Crisp/Intercom id in branding) plus platform support for admins |
| **Data portability** | Tenant export (all their data as CSV/JSON + files), a DPDP and trust requirement |
| **AI (reserved flags)** | Doubt assistant grounded on the tenant's own content (RAG over lessons), question generation from PDFs, auto-summaries of recordings |

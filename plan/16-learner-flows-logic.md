# 16 · Learner flows: logic and rules (join, learn, account, UPI, whitelist)

> **Status:** built in sessions 12, 13 and 15 (see PROGRESS.md). Where §12 differs from earlier sections, §12 wins.
> **Mockups:** [`plan/mockups-learner-flows/flows-index.html`](mockups-learner-flows/flows-index.html) (24 screens). Every screen has a yellow **Logic notes** bar (toolbar toggle) that repeats the rules for that screen. This file is the full version and wins if they ever differ.
> **Design rules:** [15-design-and-ux-guide.md](15-design-and-ux-guide.md) (version 11) and `plan/mockups/home-v11.html`. Visual decisions there are final; the learner-flow mockups give structure only.
> **Who reads this:** whoever builds these screens. Read §1 (what the owner asked), §3 (data), §4–§5 (the two risky flows), §10 (open questions), then the screen table in §2.

---

## 1. What the owner asked for (2026-11-25, in their words, tidied)

1. **Redesign every page except the home page** with the v9 design system. Mockups first, then functionality.
2. **Buying comes before the course.** A visitor signs up, buys the program, then gets the course material.
3. **Course material** contains PDFs, images, videos and **live class recordings**. Live class recordings get their own section where the learner can watch **and take notes and mark moments**.
4. **Navbar redesign.** There is **no way to log out** today. Add it.
5. **User settings page** (not the admin settings): it does not exist. Create it: edit personal details, **subscription**, and related items.
6. **Payments:** Razorpay stays but is marked **Coming soon**. **UPI QR payment is live.** The learner picks UPI, sees a QR code, pays, then either **uploads the screenshot** or is told to **WhatsApp the screenshot to a number** and **wait until verified**.
7. **Admin panel shows the pending verifications.** The admin checks the screenshot and **grants access**.
8. **Existing learners get a whitelist.** If someone signs up with an already-registered email, we recognise them, tell them they already have a subscription, and **put them straight into the subscription** (no payment).
9. Store this logic while designing. Review mockups before any build.

How each point maps to screens is in §2.

---

## 2. Screens, routes and what changes in the app

IDs are for `plan/tracker.json` (add them when this is merged; `node scripts/track.mjs`). "Exists" means a route exists today and is restyled; "New" means it is not in the app yet.

| ID | Screen | Route | State today | One job · one filled button |
|---|---|---|---|---|
| A1 | Log in | `/login` | Exists, restyle | Get back in · "Log in" |
| A2 | Sign up | `/signup` | Exists, restyle + WhatsApp field | Create the account · "Create account" |
| A3 | Confirm email | `/signup/confirm` | **New** | Prove the email is theirs · "Confirm email" |
| A4 | Welcome back (on the list) | `/welcome-back` | **New** | Say access is already there · "Go to my course" |
| A5 | Checkout (UPI live, Razorpay soon) | `/checkout/[orderId]` | Exists, rebuild | Pay · "I have paid" |
| A6 | Waiting for verification | `/checkout/[orderId]/pending` | **New** | Send the screenshot · "Send screenshot on WhatsApp" |
| A7 | Payment verified | `/checkout/[orderId]/done` | **New** (Razorpay success reuses it) | Start · "Start learning" |
| A8 | Could not match | same URL as A6, state `needs_action` | **New** | Fix it · "Pay the remaining ₹…" or "Send the screenshot again" |
| B1 | My learning | `/learn` | Exists, rebuild | Resume · "Resume lesson" |
| B2 | Course material | `/learn/[slug]/material` | **New** (replaces the curriculum list) | Find anything · none (rows are links) |
| B3 | Live classes + recordings | `/learn/[slug]/live` | **New** | Next class / re-watch · "Join class" only while open |
| B4 | Recording player + notes | `/learn/[slug]/[lessonId]` | Exists, rebuild | Learn · "Mark complete" |
| B5 | PDF viewer + notes | same, `type = pdf` | **New** | Read and mark up · none (completion in page bar) |
| B6 | Image viewer + notes | same, `type = image` | **New** | Look closely · none |
| B7 | My notes | `/learn/notes` | **New** (tracker I4) | Find a note · none ("Download as PDF" is outline) |
| C1 | Navbar (all states) | every page | Rebuild | n/a |
| C2 | Profile + reminders | `/account` | **New** | Keep details right · "Save changes" |
| C3 | Subscription | `/account/subscription` | **New** | Answer "do I have access?" · none |
| C4 | Payments and receipts | `/account/payments` | Replaces `/orders` | Prove what I paid · none |
| C5 | Password and devices | `/account/security` | **New** | Safety · "Update password" |
| C6 | Logged out | `/logged-out` | **New** | Return · "Log in" |
| D1 | UPI payments queue + review | `/admin/payments/upi` | **New** | Turn a screenshot into access · "Verify and unlock CEAP" |
| D2 | Learner list (whitelist) | `/admin/learner-list` | **New** | Record who already has access · "Add to list" |
| D3 | Payment settings | `/admin/payments` | Exists, extend | Set how learners pay · "Save settings" |

**Other existing routes (not redrawn yet, still to do with the same system):** `/courses`, `/courses/[slug]`, `/progress`, `/certificates`, `/verify/[code]`, the quiz screens, `/admin/*` other than the three above, and the not-found pages. They stay in `plan/tracker.json`.

**Redirects to add:** `/orders` and `/orders/[id]` → `/account/payments`; the old second-row learner tabs (`AccountNav`) are removed because the navbar replaces them.

---

## 3. Data changes

Everything uses existing tables where it can. Migrations go in `packages/db/supabase/migrations/` after `…26_a2_member_contact.sql`. `plan/database/` is a frozen reference; do not edit it.

### 3.1 Already in the schema (reuse, do not recreate)

| Need | Existing |
|---|---|
| The learner's access ("subscription") | `enrollments` (`source` already allows `purchase`, `import`, `admin`; `status`; `started_at`; `expires_at`; `batch_id`) |
| Manual UPI payment | `payments.gateway = 'upi_manual'` is already in the check list; `orders.status` has `awaiting_payment` and `partially_paid` |
| Notes and bookmarks | `lesson_notes` (`kind` note / bookmark / highlight, `position_seconds`, `page_no`, `body`) |
| Live classes + recordings | `live_sessions` (`status`, `starts_at`, `recording_media_id`, `join_url`) and `lessons.type = 'live'` |
| Reminder choices | `notification_preferences` (member, `event_key`, `channel`, `enabled`) |
| Device limit | `tenant_settings.security.device_limit` (JSON key already documented) |
| UPI settings | `tenant_settings.commerce` JSON: add key `upi` (see §3.4). **No new settings table.** |
| Access check | `public.my_access(tenant)` RPC (already built) |

### 3.2 New table: `access_whitelist`

```sql
create table public.access_whitelist (
  id            uuid primary key default private.uuid7(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  email_norm    text not null,                -- lower(trim(email)); the only value ever compared
  full_name     text,
  course_id     uuid not null,                -- CEAP today; several rows later = several courses
  batch_id      uuid,
  expires_at    timestamptz,                  -- null = batch end + replay window (tenant setting)
  status        text not null default 'waiting' check (status in ('waiting','claimed','expired','removed')),
  claimed_by    uuid,                         -- tenant_members.id
  claimed_at    timestamptz,
  enrollment_id uuid,                         -- the enrolment created on claim
  note          text,
  added_by      uuid not null,
  created_at    timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, email_norm, course_id),
  foreign key (tenant_id, course_id) references public.courses(tenant_id, id) on delete cascade,
  check (email_norm = lower(btrim(email_norm)) and email_norm like '%_@_%._%')
);
```

RLS: staff with `enrollment.manage` read and write; learners and anon have **no** access. The claim happens only inside the privileged function in §4.3.

### 3.3 New table: `payment_proofs`

```sql
create table public.payment_proofs (
  id            uuid primary key default private.uuid7(),
  tenant_id     uuid not null,
  order_id      uuid not null,
  payment_id    uuid not null,                -- payments row (gateway 'upi_manual'), one proof per payment
  member_id     uuid not null,
  state         text not null default 'pending_review'
                check (state in ('pending_review','approved','rejected','superseded')),
  source        text not null default 'whatsapp' check (source in ('whatsapp','upload')),
  file_path     text,                         -- private bucket, only when source = 'upload'
  utr           text,                         -- 12-digit UPI reference, optional, learner-typed
  amount_minor  bigint not null,              -- what the learner says they paid (defaults to the order balance)
  whatsapp_seen boolean not null default false, -- staff tick for source = 'whatsapp'
  money_seen    boolean not null default false, -- staff tick "I can see this payment in our UPI app or bank"
  reject_reason text check (reject_reason in ('amount_mismatch','not_received','screenshot_unclear','wrong_account','duplicate')),
  reject_note   text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  submitted_at  timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, order_id)   references public.orders(tenant_id, id) on delete restrict,
  foreign key (tenant_id, payment_id) references public.payments(tenant_id, id) on delete restrict,
  check (state <> 'approved' or (money_seen and reviewed_by is not null)),
  check (state <> 'rejected' or reject_reason is not null)
);
create index payment_proofs_queue_idx on public.payment_proofs (tenant_id, state, submitted_at) where state = 'pending_review';
create unique index payment_proofs_one_open_uk on public.payment_proofs (order_id) where state = 'pending_review';
```

Notes: the `check` on `approved` makes it impossible in the database to approve without the "I can see the payment" tick. The storage bucket `payment-proofs` is private; learners can write only their own folder, staff read. `payments.status` is **not** extended: it stays `created` until approval sets it to `captured`; the review state lives only in `payment_proofs`.

### 3.4 `tenant_settings.commerce.upi` (JSON)

```json
{ "enabled": true, "vpa": "cloudcadre@okaxis", "payee_name": "CloudCadre",
  "qr_mode": "per_order",           // or "static_image"
  "static_qr_path": null,
  "whatsapp_number": "+919876543210",
  "hours_text": "9am to 9pm, Mon to Sat", "sla_text": "usually within 2 hours",
  "alert_email": "payments@cloudcadre.in", "alert_whatsapp": null,
  "razorpay_coming_soon": true }
```

Validated by a zod schema in `packages/core/commerce`. The VPA must match `^[\w.\-]{2,}@[a-zA-Z]{2,}$`. Never put a secret here.

### 3.5 Small additions

- Permission catalog: add `payment.verify` (owner, finance). Generated catalog and seed SQL both change (`pnpm gen:…` as in PROGRESS.md).
- `notification_preferences` event keys: `live_class.reminder`, `material.new`. Channels: `whatsapp`, `email`.
- `tenant_members`: add nothing. WhatsApp number is `phone`; city goes in `custom_fields.city`; name for certificates in `custom_fields.certificate_name` (locked once a certificate row exists).
- `orders`: add nothing. Cancel unpaid UPI orders after 7 days with the existing cron route.

---

## 4. Sign-up, email confirmation and the whitelist

### 4.1 Why the code comes first

The whitelist grants access by email. If access were granted for any typed email, anyone who knows a learner's address could sign up as them and take the access. So:

1. Every new account **confirms its email with a 6-digit code before anything is granted**.
2. The sign-up form and the confirm screen are **identical for everyone**, so they never reveal whether an email is on the list.
3. Only after the code is accepted does the server check the list (§4.3).

> **This changes a current setting.** PROGRESS.md says the cloud Supabase project runs with "Confirm email: off". It must be **on** (or the code step must be implemented in the app with a one-time-password call). See §10 Q1.

### 4.2 Sign-up and login

- Sign up fields: name, email, WhatsApp (+91, 10 digits), password (8+), terms checkbox. Email is `lower(btrim())`.
- Rate limits: 5 sign-ups per IP per hour; 5 wrong passwords per email per 15 minutes then require the emailed code.
- After login a signed-in user goes to `?next` (same-site paths only), else by state: has active enrolment → `/learn`; unconfirmed email → `/signup/confirm`; order `awaiting_payment` → that checkout; proof `pending_review` → that waiting page; otherwise → `/checkout` for CEAP (creates or reuses an `awaiting_payment` order).
- Staff roles go to `/admin` and keep the authenticator step, as built.

### 4.3 The claim (server only, one transaction)

Function `private.claim_whitelist(p_member uuid)` called right after the code is accepted, and again on every login while the member has no active enrolment (so a row added later still works):

```
1. if member already has an active/paused enrolment for the course → return 'already_enrolled' (do nothing)
2. select the whitelist row for lower(btrim(member.email)) and the course
   where status = 'waiting' and (expires_at is null or expires_at > now())   for update
3. none → return 'not_listed'
4. insert enrollments (source 'import', status 'active', started_at now(),
   expires_at = row.expires_at or batch end + replay window, batch_id = row.batch_id)
5. update access_whitelist set status 'claimed', claimed_by, claimed_at, enrollment_id
6. write audit row; queue email "You are in" + WhatsApp message
7. return 'claimed'
```

- Result `claimed` → redirect to **A4 Welcome back**. `not_listed` → **A5 Checkout**. `already_enrolled` → `/learn`.
- A row claims **once**. Sign-in emails are unique in Supabase Auth, so a second account with the same email cannot exist; if staff later change a member's email the old row stays `claimed`.
- Idempotent: refreshing A4 never makes a second enrolment (the unique index `enrollments_one_live_uk` is the backstop).
- **Matching rule:** exact equality after lower-casing and trimming. No Gmail dot tricks, no `+tag` removal, **no wildcards, no whole-domain entries.**
- Staff add rows only while the course exists; removing a `waiting` row sets `removed`. A claimed row cannot be removed; staff end access from Enrolments.

### 4.4 Adding to the list (D2)

- Paste emails (newline, comma, semicolon or tab separated) or upload a CSV `email,name,batch,access_until`.
- The result is explained, never silent: **added**, **already on the list**, **already has access**, **looks wrong** (no `@`, no dot after it). Max 500 per paste.
- Permission `enrollment.manage` plus the authenticator step-up.
- Expiry blank = the batch end plus the tenant's replay window (default 6 months, in `tenant_settings.learning`).
- Open: should staff be able to email "your access is ready, sign up here" from this screen? (§10 Q4)

---

## 5. UPI payment

### 5.1 Checkout (A5)

- The **order exists before the page**: `orders` with `status = 'awaiting_payment'`, number `CC-2026-000123` from `tenant_counters`, price, GST and coupon fixed. The page only reads.
- Methods listed from settings: **UPI QR** (`commerce.upi.enabled`) is selectable, **Razorpay** shows the badge **Coming soon** and cannot be chosen (`aria-disabled`, no handler) while `razorpay_coming_soon` is true and no gateway keys exist. When the owner saves Razorpay keys (existing flow), it becomes selectable with no code change. If both are off, show "Message us on WhatsApp to pay".
- **QR content** (`qr_mode = per_order`): a UPI payment link, rendered as a QR **on the server** (no third-party image service):
  `upi://pay?pa=<vpa>&pn=<payee>&am=<balance as 49999.00>&tn=<order_no>&cu=INR`
  Amount = the order **balance** (total minus captured payments), so a top-up (§5.4) produces a QR for only what is left. `static_image` mode shows the owner's own QR image plus the amount and note to type.
- On phones also show **Open UPI app** (the same link), because a learner cannot scan their own screen.
- "I have paid" → server action `submitUpiPayment(orderId)`:
  1. create `payments` (`gateway 'upi_manual'`, `status 'created'`, `amount_minor = balance`), idempotency key `order_id + 'upi' + balance`;
  2. create `payment_proofs` (`pending_review`, `source 'whatsapp'`);
  3. notify staff (badge count; optional email/WhatsApp from settings);
  4. redirect to A6.
  Pressing it twice, or in two tabs, must create exactly one open proof (`payment_proofs_one_open_uk`).
- The learner may return to the QR any time until the order is paid or cancelled.

### 5.2 Waiting page (A6) and the screenshot

- Primary: a `wa.me` link to `commerce.upi.whatsapp_number` with the text *"Hi, my CEAP order is CC-2026-000123. Payment screenshot attached."* already filled. The learner attaches the picture in WhatsApp.
- Secondary (collapsed): upload here (jpg, png, pdf, max 5 MB) and an optional 12-digit UTR. Upload sets `source 'upload'`, stores the file in the private bucket, validates type by content not by extension. UTR must be 12 digits; if it already exists on another payment (`payments_gateway_uk`) it is rejected with "This reference was used on another order. Message us."
- The page polls every 20 s and on tab focus (`GET /api/checkout/[orderId]/state`) and switches to A7 or A8 itself.
- Copy for hours comes from settings (`hours_text`, `sla_text`). Outside the hours it says "We will check it first thing at 9am."
- Free preview lessons stay open; everything else stays locked (`my_access` returns no access).

### 5.3 Review and approval (D1)

Queue = `payment_proofs` where `state = 'pending_review'`, oldest first, with member name, phone, order number, amount, proof source, time waiting. Over 24 hours → **Overdue** chip. Sidebar badge = count of pending.

Automatic checks shown (green tick or an info mark; they inform, they do not decide):
amount equals the order balance · note equals the order number (when the learner uploaded a readable screenshot we cannot OCR it in v1; this check is the **learner-typed** order number only) · UTR not used on another payment · proof date not before the order.
> v1 does **not** read the screenshot automatically. Staff read it.

**Approve** needs: `money_seen` ticked ("I can see this payment in our UPI app or bank statement") and, for WhatsApp proofs, `whatsapp_seen` ticked. A screenshot can be faked, the money in the account cannot. The database check in §3.3 enforces the first tick.

Approve = one transaction through RPC `public.approve_upi_payment(p_proof uuid)` (security definer, requires `payment.verify`, step-up):
```
lock the proof and its order
if proof.state <> 'pending_review' → return current state (idempotent)
reviewer <> order.member (nobody approves their own payment)
payments: status 'captured', paid_at now()
captured = sum(captured payments of the order)
if captured >= order.total: orders.status 'paid', paid_at now(); fulfil order items (existing fulfilment creates the enrolment, source 'purchase');
else orders.status 'partially_paid'
proof: state 'approved', reviewed_by, reviewed_at
audit row; outbox: receipt email + WhatsApp "payment received, CEAP is unlocked"
```
**Reject** = `reject_upi_payment(p_proof, p_reason, p_note)`: proof `rejected`, payment `failed` with the reason, order stays `awaiting_payment`. Reasons are a fixed list (§3.3). The learner's A8 shows matching copy: for `amount_mismatch` it states what staff saw and what is still due.

### 5.4 Underpaid and top-ups

If the learner paid less (A8): the order keeps the captured part; the next QR is for the **balance only**, creating a second payment and proof on the same order. The order becomes `paid` only when captured payments reach the total. Account → Payments shows both payments under one order. Money paid by mistake that is not part of an order is returned by hand; staff note it on the order (existing refund record, no gateway call).

### 5.5 State machine

```
order:   awaiting_payment ──(proof approved, balance 0)──▶ paid
                 │                      └──(balance > 0)──▶ partially_paid ──(next proof approved)──▶ paid
                 └──(7 days unpaid / learner cancels)──▶ cancelled

proof:   pending_review ──approve──▶ approved
                        ──reject───▶ rejected     (learner may start a new proof → this one stays for audit)
                        ──new upload by learner──▶ superseded (only if the old one was rejected)
```

### 5.6 Messages (templates go in the existing outbox/template tables)

| Event | Email | WhatsApp |
|---|---|---|
| `payment.pending` (learner clicked "I have paid") | "We are checking your payment" + order number | none |
| `payment.verified` | Receipt + "CEAP is unlocked" + link | "Hi {name}, payment received. CEAP is unlocked: {link}" |
| `payment.needs_action` | Reason + what to do + link | Same, short |
| `whitelist.claimed` | "You are in" | "Hi {name}, your CEAP access is ready: {link}" |
| `live_class.reminder` | Evening before and 30 min before | 30 min before |

WhatsApp sending needs a provider (WhatsApp Business API or a service). Until then, **only email goes out automatically** and WhatsApp messages are copy-paste text staff send from the review screen (a "Copy message" button). See §10 Q3.

---

## 6. Learning area

### 6.1 Access and locked states

- Source of truth: `my_access(tenant)` and `enrollments.status = 'active'` with `expires_at` in the future.
- No enrolment → B1/B2/B3 show the order state (awaiting payment → checkout; pending review → waiting page; none → "Join the next batch", the one filled button) plus the free preview lessons. Never an empty dashboard.
- Months unlock by `unlock_rule` (`relative`, days after enrolment or `batch_release`). Locked rows show the date, no link.
- All learner routes send `Cache-Control: no-store`.

### 6.2 Course material (B2)

- Groups by month (`course_sections`). Filters are single-select: All, Videos (`type video`), Live recordings (`type live` with a recording), PDFs (`pdf`, `document`), Images (`image`). Counts cover the whole program, not the open month.
- Row states: completed (`lesson_progress.status`), **New** (published in the last 7 days and never opened), started with %, locked with date, my note count.
- Search matches lesson titles and the learner's own notes. The month the learner is in is open; finished months are collapsed.
- Files and recordings only via short-lived signed URLs (existing `/api/lesson-file/[lessonId]`). A file with `allow_download = false` has no download button and is watermarked with name and email.

### 6.3 Live classes and recordings (B3)

- Upcoming = `live_sessions` for the learner's batch, `status 'scheduled'`, soonest first. **Join** exists only from 10 minutes before `starts_at` until `ends_at`; opening the link records attendance once.
- Recordings = `live_sessions` with `recording_media_id`, newest first. A completed session with none shows "Recording on its way". Target: recording up the same night (the FAQ promises it).
- Every recording is also a lesson of `type 'live'` in the month list, so progress, completion (90% watched) and notes work like any video.
- **Provider is Microsoft Teams** (owner, 2026-11-25). `live_sessions.teams_join_url` holds the meeting link; "Join on Teams" opens it in a new tab.
- **The page has two sections, in this order: Scheduled classes, then Recorded classes** (owner, 2026-11-25). The dashboard shows the same two, shortened (next class + 3, newest 3 recordings).
- **A recording is one of two kinds**, set on the `live` lesson in the course editor:
  - upload: staff download the Teams .mp4 and upload it to the lesson. Plays in our player with notes, bookmarks and progress. Preferred.
  - Teams link: staff paste the Teams/Stream share link. The card is labelled "Teams link" and opens Teams in a new tab; no notes or progress (completion = opened once).
- Still open: whether learners outside the organiser's Microsoft 365 tenant can open Teams links (guest access or "anyone with the link"). See §10 Q5.

### 6.4 Notes, bookmarks, highlights (B4–B7)

- Table `lesson_notes`. **Private to the learner** (RLS `member_id` = me). Staff cannot read them.
- Video/recording: `position_seconds` = player time at the moment the note box is focused or "Mark this moment" is pressed. Bookmark has optional text. The scrubber shows a yellow tick per note and bookmark.
- PDF: `page_no`; highlights store the selected text in `body` and the page. Images: no position.
- Keyboard: **N** focuses the note box and pauses; **Ctrl+Enter** saves. Drafts autosave in the browser while typing.
- Delete shows "Undo" for 6 seconds, then deletes for good.
- Resume: heartbeat every 15 s via the existing progress API; reopening resumes 3 s before the saved second. Complete at 90% watched, at the last PDF page, or by "Mark complete".
- My notes (B7): all notes, grouped by lesson, filter by kind, search by text; each links to the lesson with `?t=1634` or `?page=3`. "Download as PDF" is generated on request.
- Access ends or refund: notes stay readable and exportable for 30 more days; lessons lock. Deleted lessons hide notes for 30 days before removal.
- Free preview lessons have no notes tab for signed-out visitors ("Log in to take notes").

---

## 7. Account (C1–C6)

- **Navbar** rules and the account menu are in the C1 notes. Log out is one click, no dialog, a form POST (works without JavaScript), ends **this device's** session, redirects to `/logged-out`. "Log out of all other devices" lives in Password and devices.
- **Profile** writes only the learner's own `tenant_members` row, only: `display_name`, `phone`, `avatar_path`, `custom_fields.city`, `custom_fields.certificate_name`. The certificate name locks once a certificate exists. Email is read only here.
- **Email change:** current password, then a 6-digit code sent to the **new** address, then a notice to the old one. Does not re-run the whitelist or touch enrolments.
- **Subscription** = the active `enrollments` row. "How you got access" by `source`: `purchase` → "Paid by UPI on {date}, order {no}"; `import` → "Added by CloudCadre; your email was on our learner list"; `admin`, `coupon`, `trial` have their own sentence. Status words: Active · Ends in N days (30 or fewer: yellow banner, WhatsApp link) · Ended (lessons locked, notes and certificate stay) · Paused.
- **No self-service cancel or refund** in v1; the refund policy is linked and staff handle it. Instalments/Razorpay will add a "Next payment" line later.
- **Payments and receipts:** one block per order, its payments below (§5.4). Receipt opens the existing receipt page. GST tax invoices are later (tracker I5).
- **Devices:** list sessions, end one, end all others. If `tenant_settings.security.device_limit` is set, a login beyond the limit ends the oldest session.

---

## 8. Permissions summary

| Action | Permission |
|---|---|
| Verify or reject a UPI payment | `payment.verify` (**new**) + authenticator step-up |
| Add, remove or import the learner list | `enrollment.manage` + step-up |
| Change payment settings (UPI, Razorpay) | existing payment-settings permission + step-up |
| View UPI queue read-only | `order.view` |
| Everything in the learner area | signed-in member with an active enrolment (`my_access`) |

Nobody can approve their own order. Every approve, reject, add, remove and settings change writes an audit row (who, when, before/after).

---

## 9. Design decisions that go beyond guide 15 (confirm in review)

These are choices made so the screens work; the guide has no rule for them.

1. **App page titles use the H2 size** (30–42px, weight 750), not the 62px hero H1. One H1 per page is kept (the element is `h1`, styled as H2).
2. **Status colours:** no red. "Needs attention" is ink on stone with a left bar; "waiting" is pale yellow; "verified/active" is mist and teal. Keeps the palette to guide §4.
3. **Mist panel** is used for the learner's own climb (it is the program), the one allowed use.
4. **Yellow tick marks on the video scrubber** show where the learner took notes; counted as the one yellow element of the player.
5. **Admin pages** use the same tokens in a dense layout with a sidebar (guide §14 `/admin/*`).
6. **Stock photos** (Unsplash) in the mockups are placeholders, marked in code comments. The QR and the payment screenshot are drawn placeholders, not scannable.

Placeholders to replace with real data before launch: price (₹49,999 incl. GST), batch dates (12 Jan, Oct 2026), UPI ID `cloudcadre@okaxis`, WhatsApp +91 98765 43210, verification hours, trainer names, counsellor name and photo, class photos.

---

## 10. Open questions for the owner

| # | Question | Why it matters | Default if no answer |
|---|---|---|---|
| Q1 | OK to turn **email confirmation on** for every sign-up (6-digit code)? | The whitelist is unsafe without it (§4.1) | Yes, required |
| Q2 | Should the learner **upload** the screenshot on the site, **WhatsApp** it, or both? | Changes A6 and the queue | Both: WhatsApp is the main button, upload is secondary |
| Q3 | Do you have a **WhatsApp Business API** or a sender service, or do staff message by hand? | Decides whether WhatsApp messages are automatic | Email is automatic; WhatsApp is copy-paste from the review screen |
| Q4 | Should the learner-list screen be able to **email** "your access is ready" to the people you add? | Extra mail volume and copy | Not in v1 |
| Q5 | ~~Which tool runs live classes?~~ **Answered 2026-11-25: Microsoft Teams**; recordings are an uploaded Teams video or a Teams link. Still open: can learners outside the organiser's tenant open Teams recording links? | Link recordings fail for learners who can't open them | Upload every recording; use links only as a same-night fallback |
| Q6 | How long should access last (**replay window** after the batch ends)? | Sets `expires_at` for paid and listed learners | 6 months after batch end |
| Q7 | **Device limit** for logins (for example 2)? | Stops sharing one paid account | Off until you decide |
| Q8 | Final **price**, GST treatment and whether **instalments by UPI** are offered (each instalment would need its own check) | Order totals and the QR amount | One payment of ₹49,999 incl. GST; top-ups only for shortfalls |
| Q9 | Who **verifies** payments, and in which hours? | Sets hours text and the permission holders | Owner + one finance user, 9am to 9pm Mon to Sat |
| Q10 | What happens to someone on the list whose batch has **already ended**? | Their access might expire the moment they sign up | `expires_at` blank = batch end plus replay window; if that is in the past, staff must set a date, and the add screen warns |

---

## 11. Build order and tests (when the owner says "build")

**Slices, each ending with the stack running and tested:**
1. Navbar + account shell + log out + Profile + Subscription + Payments (reads existing data). Fixes "cannot log out" first.
2. Email confirmation + sign-up/login restyle.
3. Whitelist (table, claim function, D2) + A4.
4. UPI settings (D3) + checkout rebuild (A5) + QR + `submitUpiPayment` + waiting page + states A6–A8.
5. UPI queue (D1) + `approve_upi_payment` / `reject_upi_payment` + messages.
6. Learning area: B1, B2, B3, then the viewers with notes B4–B7.

**Tests that must exist:**
- SQL: approve without `money_seen` fails; approve twice is a no-op; approving your own order fails; claim twice yields one enrolment; a removed or expired list row never claims; a different email never claims; paid + top-up reaches `paid` only at the full total; RLS: a learner cannot read another learner's proofs, notes or the whitelist; anon reads nothing.
- Playwright (cloud project, one flow each): sign up → confirm → listed email → welcome back → lesson opens; sign up → confirm → not listed → pay QR → "I have paid" → waiting → staff approve → learner unlocked; reject with amount mismatch → top-up → approve → unlocked; add a note at a timestamp and reopen at that time; log out from the menu on desktop and phone.
- Visual: every screen at 1280 and 390 wide with no sideways scroll, 44px targets on phone, keyboard focus visible, reduced motion respected (guide §16 checklist).

## 12. Dashboard (flow E, approved and built 2026-11-25)

Mockup: `plan/mockups-learner-flows/flow-dashboard.html` (E1–E7; open "Logic notes" on each screen).

- **"My learning" is renamed "Dashboard" everywhere** (bar, phone menu, account button, emails). Route `/dashboard`; `/learn` redirects there (308). Course material, live classes and notes keep their `/learn/…` URLs.
- **The dashboard is the signed-in default page.** Log in and email confirm redirect to `/dashboard` (a safe `next` still wins). Signed in, the logo links to `/dashboard`. `/` still shows the home page if typed (no redirect); its header swaps "Log in" and "WhatsApp us" for an outline "Dashboard" button and the account button.
- **Log out goes to `/`** with a "You're logged out" note. `/logged-out` (C6) and `/welcome-back` (A4) become redirects.
- **Batches:** one program (CEAP). The Oct 2026 batch is running; the next batch starts 8 Jan 2027. The page reads both from `batches` (status, `start_date`), never from copy.
- **Change to §4 (whitelist):** a list match is no longer claimed silently on email confirm. A member with no enrolment whose confirmed email is on the running batch's list sees "You seem to be in the current batch: Join my batch now" (filled) and "Join the next batch instead" (outline). The button calls the same claim (enrolment `source = 'import'`, idempotent). Everyone else sees only "Join the next batch" → checkout.
- **Dashboard states:** enrolled and running (E1), just claimed (E2, one-time banner), enrolled before the batch starts (E3, countdown and checklist), on list (E4), not on list (E5), UPI under review (E6). Never an empty dashboard.
- **Progress shown:** overall % and lessons, pace against lessons released to the batch (never against other learners), labs, live classes attended, month tests, notes, this week's items, the climb, study material counts by type, certificate requirements.

**Built (session 15), with these differences from the mockup:**
- Joining a **running** batch sets the enrolment's start to the batch start, so months already open to the batch are open to the learner (migration 34).
- Thumbnails are drawn (date or icon), not photos. Trainer names, a named counsellor, class numbers and week ranges are left out: there is no data for them yet.
- The "before your batch starts" checklist ticks only what is recorded (certificate name, preview lesson). Teams and the WhatsApp group (`batches.settings.whatsapp_group_url`) are links without ticks.
- The certificate card lists lessons and tests only; there is no capstone record yet.
- Recordings: no `recording_kind` column. A `live` lesson with a media file is the upload; one with `external_url` is the Teams link.


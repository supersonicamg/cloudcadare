# 07 · Security, Authentication & Authorization

## 1. Threat model (what we defend against)

| Threat | Primary controls |
|---|---|
| Tenant A reads or writes tenant B's data | RLS on every table; composite `(tenant_id, id)` FKs; tenant resolved server-side only; pgTAP isolation tests in CI |
| Learner escalates to staff actions | Permission-based RLS (`perm_tenants`), no client grants on sensitive tables, server-side `requirePermission`, column-level grants |
| Answer-key leak / test cheating | `question_keys` unreadable; paper snapshot without keys; server deadlines; autosave guards; results gated by visibility |
| Paid content piracy | Signed short-TTL URLs, provider-signed video playback, DRM add-on, dynamic watermark (name + phone), device limits, `course-media` bucket never directly readable |
| Payment fraud / tampering | Webhook-only fulfilment, signature verification, idempotent inbox, amounts from server-side snapshots, never from the client |
| Account takeover | OTP rate limits, Turnstile, MFA (TOTP) for staff (`aal2` for sensitive permissions), session/device management, suspicious-login alerts |
| Stored XSS via CMS/branding | Typed blocks only (no raw HTML), sanitized rich text (Tiptap JSON → allow-listed renderer), no SVG uploads to public bucket, CSP with nonces |
| Secrets exposure | Supabase Vault for gateway/integration secrets; secret key only in server modules (lint-enforced); no secrets in `NEXT_PUBLIC_*` |
| Insider misuse (platform staff) | Impersonation is time-boxed, reasoned, read-only by default, audited in both control and tenant logs, and visible to the academy |
| Noisy neighbour / abuse | Per-tenant and per-IP rate limits (Upstash), quotas, statement timeouts, move heavy tenants to a dedicated plane |
| Supply chain | Lockfile, Renovate with review, `pnpm audit`/OSV in CI, pinned GitHub Actions SHAs, minimal dependencies in `core` |

## 2. Authentication

**Provider:** Supabase Auth on each data plane (pooled plane = shared identity pool; dedicated plane = its own).

| Method | Default | Notes |
|---|---|---|
| **Email + password** (the only method built; ADR-13) | ✓ everyone | Minimum 8 characters. Email and WhatsApp number are **not verified** (no mail server), so check who someone is before granting access or resetting a password (`scripts/set-password.mjs`) |
| Phone OTP (SMS via MSG91 DLT, or WhatsApp OTP) | Deferred (ADR-13) | Send SMS Hook → our function → MSG91 (DLT template). Rate limit: 3 per 10 min per phone, 10 per hour per IP |
| Email OTP / magic link | Deferred: needs a mail server (ADR-13) | Through the auth bridge for custom domains (see [03 §4](03-distribution-and-tenancy.md)) |
| Google / Apple / Microsoft OAuth | optional per tenant | Through the auth bridge |
| Email + password | optional | Leaked-password protection on; minimum length 10 |
| SAML / OIDC SSO | `integrations.sso` | Corporate training customers |
| TOTP MFA | **required for staff holding sensitive permissions** | Enforced in RLS (`aal2`) when `security.require_mfa_for_sensitive`, and in the DAL |

- **Sessions:**
  - Cookies set by `@supabase/ssr` per domain: `HttpOnly`, `Secure`, `SameSite=Lax`.
  - JWT signed with **asymmetric keys**, so `supabase.auth.getClaims()` verifies locally in proxy and the DAL without a network hop.
  - Access token 1 h, refresh rotation on.
- **Tenant membership is not in the JWT.** The DB derives it from `tenant_members` on every query, which means instant revocation with no stale claims. Custom Access Token Hook claims are reserved for `impersonator_id` (support sessions) and `platform_staff` (console).
- **Signup into a tenant:** a user who signs up on `academy-a.com` gets a `tenant_members` row for A only. Visiting academy B shows "Join B?" and creates a separate member row there if B allows open signup.
- **Shared identity in pooled planes:** one email/phone can belong to several academies. With OTP-first login there is no shared password to leak across academies. Fully separate identity is available through a dedicated plane.
- **Device limits** (`security.device_limits`):
  1. Login registers a `member_devices` row (fingerprint plus `auth_session_id`).
  2. If active devices exceed the limit, the oldest session is revoked through the admin API.
  3. Proxy checks a short-lived revocation cache (Redis) so the revoked session is kicked within seconds.

## 3. Authorization model

```
can(user, permission, tenant[, scope]) =
     member(user, tenant).status = 'active'
 AND ∃ member_roles(member, role, scope ∈ {tenant | branch | batch | course}, not expired)
 AND role_permissions(role, permission)
 AND feature_enabled(tenant, permission_catalog[permission].feature_key)      -- inert if module off
 AND (NOT permission.is_sensitive OR NOT tenant.require_mfa OR session.aal = 'aal2')
```

- **Catalog:** 61 permissions seeded (`public.permission_catalog`), grouped for the roles UI, each tied to a feature.
- **Learner rights are implicit:** "own rows" (`member_id ∈ my_member_ids()`) plus "content of courses I'm enrolled in" (`course_id ∈ my_course_ids()`), not role permissions.
- **The same function exists in three places:** SQL (`private.perm_tenants`, `perm_scopes`), TypeScript (`@permissions.can()` reading the same tables via one cached query per request), and UI (`<Can perm="…">`). The DB is the final authority.

## 4. RLS architecture (see `database/95_rls_policies.sql`)

- **Default deny:**
  - RLS is enabled on all 132 tables.
  - All privileges are revoked from `anon` and `authenticated`, including Supabase's default grants.
  - `EXECUTE` is revoked from `PUBLIC` globally.
  - `anon` has **zero** grants (lint #4).
- **Fast policies:** helper functions are `STABLE SECURITY DEFINER` with `search_path=''`, and are used as `tenant_id IN (SELECT private.fn())`. The subquery is uncorrelated, so it is evaluated once per statement and hashed rather than run per row. The membership, role and permission join paths are indexed.
- **Access classes:**

  | Class | Examples | Learner | Staff |
  |---|---|---|---|
  | member_read_staff_write | courses, sections, batches, tests, products, levels, badges | read (published / enrolled filter) | write with permission |
  | staff_only | questions, question_keys, coupons, leads, site_pages, audit_logs | — | read/write with permission |
  | owner_read | enrollments, lesson_progress, certificates, orders, xp_ledger | read own | read with permission |
  | owner_write | lesson_notes, votes, notification_preferences, push_subscriptions | full own | — |
  | definer-only | test_attempts writes, attempt_answers, progress writes, payments, tenant_counters, outbox | via RPC | via server |

- **Column-level grants** where learners can update their own rows: profile (`display_name`, `avatar_path`, `locale`), notification `read_at`, thread/post body only, review text only. Moderation fields are server-side.
- **Views** use `security_invoker = true` (lint #3), so the caller's RLS applies.
- **Storage policies** use path prefixes (`{tenant_id}/…`):
  - `course-media` is never directly readable by learners; the server mints a 60–300 s signed URL after an entitlement and unlock check.
  - `submissions` are owner-write and grader-read.
- **Secret-key code paths** bypass RLS by design, so they live only in `packages/core/**/privileged/*` and `apps/workers`. Every such function takes an explicit `tenantId`, re-checks authorization in TypeScript, and is covered by unit tests asserting tenant scoping.

## 5. Next.js application security

- **DAL pattern** (from the Next.js data-security guide): all data access goes through `server-only` modules that resolve the user and tenant, check authorization and return **minimal DTOs**. Components never receive raw rows. `experimental.taint` is used for secret-bearing objects.
- **Server Actions:**
  - Zod-validate every input.
  - Re-check auth and permission in each action; actions are public endpoints.
  - Same-origin checks are built in, and `serverActions.allowedOrigins` is set to the tenant's domains.
- **Proxy** does only optimistic checks (redirects). Real authorization is in the DAL, as the Next.js docs require.
- **Headers:**
  - CSP with per-request nonce: `script-src 'self' 'nonce-…' https://checkout.razorpay.com …`, `frame-ancestors 'none'` except the embed routes
  - HSTS preload
  - `X-Content-Type-Options`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (camera/mic only on proctoring and live routes)
- **Rate limiting** (Upstash): auth endpoints, license redemption, form submissions, checkout creation, the progress RPC (≤ 1 call per 5 s per lesson per member), search, the public API (per key).
- **Bot protection:** Cloudflare Turnstile on signup, lead forms and OTP requests.
- **File uploads:**
  - Size and MIME allow-lists per bucket.
  - Server-side magic-byte sniffing in the worker.
  - Optional ClamAV scan for submissions.
  - Images re-encoded (sharp) to strip EXIF/GPS.

## 6. Content protection (paid academies' #1 worry)

| Layer | Implementation |
|---|---|
| Delivery | Video by provider-signed playback tokens (TTL ≈ lesson length + 1 h, bound to the member); documents by Storage signed URLs (60–300 s) |
| DRM (add-on) | VdoCipher/Mux DRM (Widevine/FairPlay) blocks screen capture on supported devices |
| Watermark | Dynamic overlay (name + masked phone + timestamp), moving position; burned into PDF downloads (server-side stamping) |
| Sharing | Device limits, concurrent-stream limit, anomaly detection (same account, many IPs/cities) → alert |
| UX deterrents | Disable right-click/download on viewers, blur on tab hidden (configurable) |

Be honest with clients: nothing stops a phone camera. Watermarks make leaks traceable, which is the real deterrent.

## 7. Privacy & compliance: India DPDP Act 2023

| Obligation | Design |
|---|---|
| Consent & notice | `consents` with purpose, policy version, evidence (IP, UA, OTP ref), withdrawal; granular marketing and WhatsApp consent |
| **Children (under 18)** | `tenant_members.is_minor`; **verifiable guardian consent** flow (guardian OTP) before processing; no behavioural ads or tracking; leaderboards default to `anonymize` |
| Data principal rights | `data_subject_requests` (access, export, correction, erasure, grievance) with SLA; a self-service export |
| Erasure | Anonymize the member (name → "Deleted user", clear email/phone/custom fields, null `user_id`, status `erased`). **Retain financial records** (GST law, ~8 years) and aggregate stats |
| Roles | Academy = data fiduciary; platform = data processor (DPA in contract); sub-processors listed (Supabase, Vercel, Mux, MSG91…) |
| Breach | Incident runbook with a 72 h notification template; audit logs to support investigation |
| Residency | Mumbai region for data; providers chosen with India PoPs |
| Retention | Configurable: learning events 24 months hot then archive; audit 1–7 years by plan; notifications 90 days |

## 8. Audit

- **Tenant audit** (`public.audit_logs`, partitioned): generic trigger on roles, permissions, member roles, modules, branding, settings, gateway accounts, prices, coupons, orders, payments, refunds, tests, answer keys, API keys, webhooks, integrations and members. It records the changed-fields diff (secrets excluded), the actor and the impersonator. The DAL adds business events (exports, grade changes, access grants).
- **Control audit** (`control.audit_logs`): every console action, license redemption and impersonation.
- Shown in admin ("Activity") and the console, exportable. Retention is per plan.

## 9. Security testing

- **pgTAP suite** (extends `tests/smoke_test.sql`), on every PR:
  - For every table: as learner A, staff A and owner B, assert the read and write matrix.
  - Generated from a YAML matrix, so new tables fail CI until they are classified.
- `tests/lint.sql` gates: RLS on, `search_path` pinned, no `anon` grants, no `anon`-executable definers, FKs indexed, `tenant_id` present.
- **App tests:** authz unit tests per server action (unauthenticated, wrong tenant, wrong permission, feature off).
- **DAST:** OWASP ZAP baseline against staging nightly.
- **Pen test:** before the first paid launch, then yearly.
- Dependency and secret scanning: Renovate, OSV, gitleaks.

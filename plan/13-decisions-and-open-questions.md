# 13 · Architecture Decisions & Open Questions

## A. Decision log (ADR summary)

| # | Decision | Alternatives considered | Rationale | Revisit when |
|---|---|---|---|---|
| ADR-01 | **Separate control plane (`control` schema) from data plane (`public`)**, with a synced projection | One schema; distributor data mixed with tenant data | An RLS bug in tenant tables can never expose distributor data. Control can later move to its own project, and dedicated tenants need it anyway | — |
| ADR-02 | **Hybrid tenancy:** pooled (RLS) by default, dedicated project per enterprise tenant, same migrations | DB-per-tenant for all; schema-per-tenant | Cheap and simple for small academies, real isolation when sold. Schema-per-tenant multiplies migration and pooling pain without the benefits of a real silo | >1000 tenants per plane |
| ADR-03 | `tenant_id` on **every** data-plane row + composite `(tenant_id,id)` FKs + UUIDv7 | Single-column FKs; serial ids | DB-level cross-tenant integrity, tenant move/export, no ID collisions across planes | PG18 → native `uuidv7()` |
| ADR-04 | **`anon` role gets nothing.** Public pages are server-rendered from cached DAL reads | Public RLS policies for anonymous Data API access | Removes a whole class of scraping and leak risks; public pages are cached anyway | — |
| ADR-05 | **Sensitive writes only via SECURITY DEFINER RPCs or the server's secret-key path** (progress, attempts, grades, payments, XP, roles) | Client writes with RLS `WITH CHECK` | Business rules (deadlines, completion rules, idempotency) can't be expressed safely in RLS alone | — |
| ADR-06 | **Two-layer toggles:** entitlement (distributor) AND module setting (tenant). Resolution in SQL, materialized and synced | Feature-flag SaaS (LaunchDarkly, PostHog flags) | Entitlements are commercial data tied to billing and limits, and must be enforced in the DB too. Flag SaaS stays available for UI experiments | — |
| ADR-07 | **Membership not in the JWT**; derived per query via indexed helpers | Custom Access Token Hook with a tenant/role claim | Instant revocation, multi-academy users, no token bloat. Cost is mitigated by uncorrelated subqueries | If RLS helper cost shows in `pg_stat_statements` |
| ADR-08 | **One flexible content model** (`courses.kind` + nested sections + typed lessons with JSON rules) | Separate models per vertical | Every vertical maps onto it, and modules stay toggleable without schema forks | — |
| ADR-09 | **Headless core + 4-level frontend customization** (tokens → blocks → themes → custom zones) | Fork the app per client; one rigid UI | Forks rot. One rigid UI can't sell to premium clients. Zones give full freedom without forking logic | — |
| ADR-10 | **Transactional outbox** for side effects | Direct calls in actions; DB triggers calling HTTP (`pg_net`) | No lost or phantom notifications; retries; decoupled modules | — |
| ADR-11 | **Supabase + Next.js on Vercel**, Mumbai region | AWS-native (RDS + Cognito + ECS); Firebase | Fastest path with RLS, Auth, Storage and Realtime in one; Vercel custom domains. The core is portable (OpenNext/AWS) if needed | Cost or compliance demands |
| ADR-12 | **Each academy is the merchant of record** (own Razorpay/Stripe) | Platform collects and pays out (Route/Connect Express) | Avoids marketplace/PA licensing, payout liability and GST complexity for the platform | If offering a marketplace |
| ADR-13 | **Phone OTP first** for learners | Passwords first | Indian user expectations; no shared passwords across academies in a pooled identity pool | — |
| ADR-14 | **Text + CHECK enums**, JSONB only for configs and content | Postgres enum types; EAV | Easy evolution; relational where queried | — |
| ADR-15 | **Snapshots** (orders, invoices, papers, certificates) | Live references | History must not change | — |

## B. Known trade-offs & mitigations

| Trade-off | Mitigation |
|---|---|
| A pooled plane shares one Auth pool, so one email/phone is one identity across academies on that plane | OTP-first; per-tenant member profiles; dedicated plane for full separation; white-label emails and SMS from the tenant's sender |
| The RLS helper subqueries add cost to every query | Indexed paths, hashed subplans; monitor; fall back to JWT claims for hot tables if needed (ADR-07) |
| Custom zones mean hard navigations between learner and admin | Split zones along natural boundaries; the admin zone is rarely visited by learners |
| Count-based limit triggers cost a `count(*)` per insert | Only on low-volume tables (courses, members, branches); bulk imports validate once and set `app.bulk_limit_checked`; switch to counters if needed |
| Leaderboards are snapshots (up to 15 min stale) | Redis ZSET for live boards when an academy needs it; "updated x min ago" label |
| Cross-plane analytics for the platform | Warehouse via CDC, never direct cross-plane queries |

## C. Open questions for CloudCadre (first customer)

**Business & content**

1. Course list and bundle structure for launch. Pricing (one-time vs installments vs subscription)? Validity per course (lifetime / 12 months)?
2. Delivery mix: self-paced video, live cohorts, or both? Cohort size and schedule pattern?
3. Do they run **hands-on labs**? Which provider (own AWS/Azure sandboxes, or a vendor)? Is lab completion tracked?
4. Certification prep: do they need **mock exams** mimicking AWS/Azure formats (65 questions, 130 min, multi-select, no negative marking)?
5. Certificates: design, signatories, need for public verification and LinkedIn sharing?
6. Gamification appetite: XP, levels, badges, leaderboards on at launch? Public or batch-only boards?
7. B2B: do they train corporate teams (SSO, bulk seats, company dashboards, invoices to companies with GSTIN)?

**Operations**

8. Existing content and learners to migrate (where from: Graphy, Teachable, Classplus, spreadsheets)?
9. Payment gateway: do they have Razorpay (KYC done)? GST registered? Invoice series format?
10. Video: expected hours of content and monthly watch hours (drives the Mux vs Bunny vs VdoCipher choice)? Is DRM required?
11. Live classes: Zoom account type? Google Workspace? Recordings to be published to learners?
12. Communication: WhatsApp Business number? Email sending domain? SMS needed (DLT entity registered)?
13. Faculty: how many? Do they need the syllabus-plan tracking from day one?
14. Support: who answers learner queries (in-app chat, WhatsApp, email)?

**Brand & UX**

15. Brand guidelines (logo, colours, fonts)? Reference websites they like?
16. Domain (`cloudcadre.in`? `learn.cloudcadre.in`)? Is a custom L4 frontend expected, or is a theme enough?
17. Languages: English only, or Hindi too?

**Compliance**

18. Do any learners fall under 18? (This drives the DPDP minors flow.)
19. Data residency or contractual requirements from corporate clients?

## D. Open questions for you (platform owner)

1. Platform brand name and base domain (replace `yourplatform.app` in `99_seed_catalog.sql`).
2. Will you work with resellers in year 1, or platform-only? (Phase 4 scope.)
3. Platform pricing in INR, and whether self-serve trials (no key) are offered.
4. Hosting preference: Vercel (recommended for custom domains) vs AWS/Cloudflare (cost or credit reasons)?
5. Support model and SLAs per plan.
6. Which second vertical to target first (NEET/JEE vs K-12 vs UPSC), so the Phase 3 order can be fixed.

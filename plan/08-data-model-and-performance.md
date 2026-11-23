# 08 · Data Model & Performance

## 1. Schema map (132 tables)

```
control (27)                         public — data plane (105 + partitions)
────────────                         ────────────────────────────────────────────────────────────
platform_settings                    TENANCY     tenants · tenant_entitlements · tenant_modules
distributors ─┬─ distributor_members             tenant_branding · tenant_settings · tenant_counters
              ├─ plans ── plan_features PEOPLE   tenant_members ─┬─ member_roles ── roles ── role_permissions
              ├─ addons ── addon_features                         ├─ guardian_links · instructor_profiles
              ├─ license_keys ── license_activations              ├─ member_devices · consents · data_subject_requests
              └─ tenants ─┬─ tenant_domains                       └─ invitations · custom_field_definitions · branches
                          ├─ tenant_subscriptions  CONTENT  taxonomy_terms · media_assets
                          ├─ tenant_addons                  courses ─┬─ course_sections (tree) ── lessons ── lesson_resources
                          ├─ tenant_feature_overrides                └─ course_instructors
                          ├─ tenant_entitlements   COHORT   batches ─┬─ batch_courses · batch_instructors · batch_content_releases
                          ├─ usage_records                           ├─ live_sessions ── live_session_hosts · attendance_records
                          ├─ platform_invoices                       └─ syllabus_plans ── syllabus_items ── syllabus_coverage
                          ├─ impersonation_sessions LEARNING enrollments ── lesson_progress · lesson_notes
                          └─ provisioning_jobs               daily_activity · learning_events (partitioned)
features                                                     certificate_templates · certificates
vertical_templates · frontend_templates  ASSESS questions ── question_keys · question_stats
data_planes · reserved_slugs                    tests ── test_sections ── test_questions
outbox_events · audit_logs                      test_attempts ── attempt_answers · assignments ── assignment_submissions
platform_announcements             ENGAGE   xp_ledger · member_stats · levels · badges · member_badges
                                            leaderboards ── leaderboard_entries · discussion_threads ── discussion_posts
                                            votes · content_reports · reviews · announcements
                                   COMMERCE payment_gateway_accounts · tax_rates · products ── product_items · prices
                                            coupons ── coupon_redemptions · orders ── order_items · installments
                                            payments ── refunds · invoices · member_subscriptions
                                            affiliates ── affiliate_conversions · gateway_webhook_inbox
                                   COMMS    notification_templates · notifications · notification_preferences
                                            push_subscriptions · message_deliveries
                                   CMS/CRM  site_pages ── site_page_versions · site_navigation · blog_posts
                                            showcase_items · faqs · forms ── form_submissions · leads ── lead_activities
                                   OPS      audit_logs (partitioned) · outbox_events · api_keys · webhook_endpoints
                                            webhook_deliveries · integrations · import_jobs
private  role_templates + helper functions (RLS helpers, grading, progress, leaderboards, limits)
```

## 2. Conventions (enforced by review + `tests/lint.sql`)

| Rule | Reason |
|---|---|
| `id uuid default private.uuid7()` | Time-ordered (B-tree friendly), globally unique (tenant moves), non-guessable counts |
| `tenant_id NOT NULL` on every data-plane table | Same code pooled/siloed; RLS anchor; tenant export/move |
| `UNIQUE (tenant_id, id)` on referenced tables + composite FKs `(tenant_id, x_id)` | The DB guarantees a child can't reference another tenant's row, even if app code has a bug |
| `ON DELETE SET NULL (col)` column-list form | Composite FKs null only the reference, not `tenant_id` |
| Enumerations = `text + CHECK` | Add values with a simple migration; readable in SQL |
| Money = `bigint` minor units, `currency char(3)` | No float errors; multi-currency ready |
| Time = `timestamptz` (UTC); "days" computed in tenant timezone | Correct streaks/daily boundaries for every academy |
| JSONB only for flexible configs/content (rules, blocks, rich text, custom fields) | Relational for everything queried/joined; JSON shapes validated by Zod in app |
| Soft delete only on authored content (`deleted_at`) | History (progress, attempts) stays consistent; transactional rows are immutable |
| Snapshots on orders, invoices, certificates, test papers | History never changes when catalog/prices/questions change |
| Append-only ledgers (`xp_ledger`, `learning_events`, `audit_logs`, `outbox_events`) + derived aggregates | Auditable, idempotent, rebuildable |
| Every FK indexed (lint #6, `97_fk_indexes.sql`) | Fast cascades/joins |

## 3. Hot paths & how they stay fast

| Path | Expected load (target scale) | Design |
|---|---|---|
| Host → tenant | every request | Redis/Edge Config map, ~1 ms, no DB |
| Public pages (home, catalog, course) | 90% of anonymous traffic | `'use cache'` with tenant tags → static shell + streamed dynamic parts (PPR); DB hit only on revalidation |
| Learner dashboard | per login | 3–5 indexed queries on `(member_id …)` indexes; `member_stats` precomputed; no aggregations over ledgers at read time |
| Progress heartbeat | 1 per 15 s per active video viewer → 10k concurrent viewers ≈ 670 writes/s | Single RPC, one row-lock on the enrollment, upserts keyed by PK; time delta capped; client debounces & batches; optional Redis buffer if >2k/s |
| Test start (mock exam at 10:00 for 20k students) | burst | Paper build is one SQL statement; pre-warm by opening the test 5 min early ("lobby"); stagger with jitter; Supavisor pool sizing; `random()` pools pre-sampled into static papers for huge exams |
| Answer autosave | every answer change, ≈ 2–4/min per candidate → 20k × 3/min ≈ 1k writes/s | PK upsert on `(attempt_id, question_id)`; client queue + coalescing (send latest per question every 5 s) |
| Submit + grade | burst at deadline | Grade is set-based SQL (one statement per attempt); ranks computed once after window closes; cron catches stragglers with `SKIP LOCKED` |
| Leaderboards | many reads | Snapshot table read by PK/rank index; live ZSET in Redis if needed |
| RLS overhead | every query | Uncorrelated `IN (SELECT helper())` → hashed subplan once per statement; helpers hit `tenant_members(user_id)` + `member_roles(member_id)` + `role_permissions(permission_key, role_id)` indexes |
| Search | catalog | `courses.search_vector` (GIN) + trigram on names; Typesense later |

## 4. Partitioning & retention

- Partitioned monthly by `occurred_at`: `learning_events`, `audit_logs`. Partitions are created ahead by `private.ensure_monthly_partitions()` (daily cron), with a `DEFAULT` partition as a safety net.
- **Retention:**
  - Detach partitions older than 24 months (events) or the plan limit (audit), export them to Parquet in object storage, then drop.
  - `notifications`: delete read items older than 90 days.
  - `outbox_events`: delete published events older than 14 days.
  - `gateway_webhook_inbox`: keep 1 year.
- **Candidates later** (when they exceed ~50M rows): `lesson_progress` (hash by `tenant_id`), `attempt_answers` (range by attempt time), `notifications`.

## 5. Connections & serverless

- App uses Supabase Data API (PostgREST) over HTTP for user-scoped queries → no direct Postgres connections from serverless functions.
- Workers use **Supavisor transaction mode** (port 6543), prepared statements off, small pool per worker.
- Statement timeouts: `authenticated` 8 s, `anon` n/a, workers 60 s (per-role `ALTER ROLE … SET statement_timeout`).
- Long reports run on a **read replica** (Supabase read replicas) via a separate connection string.

## 6. Scaling path

| Stage | Size (indicative) | Actions |
|---|---|---|
| **S0** – launch | 1–20 academies, <20k learners | One Supabase project (control + pooled plane), Small/Medium compute, Vercel Pro |
| **S1** | 20–200 academies, <200k learners | Split control plane into its own project; pooled plane on Large compute; read replica for reports; Redis for rate limits & leaderboards; CDN tuning |
| **S2** | 200–1000 academies, ~1M learners | Multiple pooled planes (`-02`, `-03`) – new tenants placed by capacity; big tenants moved to dedicated planes; CDC → ClickHouse for analytics; Typesense for search |
| **S3** | 1M+ learners | Partition hot tables by tenant hash; queue-buffered heartbeats; regional planes (if expanding outside India) |

The scale-out unit is the **data plane**. Because no query spans tenants, you add planes instead of sharding one huge database. Cross-tenant analytics for the platform go through the warehouse, not production.

## 7. Performance budgets (CI-enforced)

- Public page TTFB < 200 ms (cached), LCP < 2.5 s on 4G mid-range Android, JS < 170 KB gz on learner routes.
- p95 API/server-action < 300 ms; RPC `record_lesson_progress` p95 < 50 ms; `start_test_attempt` p95 < 400 ms (200 questions).
- k6 load tests in staging per release: 10k concurrent video heartbeats; 20k-candidate mock exam (start → autosave → submit).
- `pg_stat_statements` review weekly; Supabase Index Advisor; alert on seq scans on tables > 100k rows.

## 8. Backups & recovery

- Supabase PITR (7–28 days) on every plane; daily logical dump (`pg_dump` of the plane) to separate cloud storage (cross-provider) with 30-day retention.
- Storage buckets replicated nightly to R2/S3.
- **Per-tenant restore** possible because of `tenant_id` everywhere: restore the snapshot to a scratch project → copy `WHERE tenant_id = X` back.
- RPO ≤ 5 min (PITR), RTO ≤ 4 h (documented and rehearsed quarterly).

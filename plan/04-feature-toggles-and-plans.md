# 04 · Feature Toggles, Plans & Limits

Every capability beyond the core is a **feature** with a stable key. An academy only sees, pays for and loads what it is entitled to.

## 1. Two layers

```
             Distributor decides                       Academy admin decides
     ┌───────────────────────────────────┐      ┌──────────────────────────────┐
     │ ENTITLEMENT  (control plane)       │      │ MODULE SETTING (data plane)   │
     │ plan ∪ add-ons, ± overrides,       │ AND  │ tenant_modules.is_enabled     │
     │ dependencies, limits               │      │ (only for tenant_can_toggle)  │
     └───────────────────────────────────┘      └──────────────────────────────┘
                         effective(feature) = entitled AND enabled
```

- **Entitled but disabled:** the academy bought gamification but turned it off for now. No charge change; they can turn it on any time.
- **Not entitled:** the module is invisible in the learner UI. Admin UI shows it as an *upsell card* ("Available on Pro"), not as a broken page.
- **Vertical defaults** pre-disable some entitled modules (e.g. `commerce.offline_payments` for cloud training).

## 2. Resolution algorithm (`control.resolve_entitlements`)

For each feature `f`:

| Step | Rule |
|---|---|
| 1 | `f.is_core` → **enabled**, source `core` |
| 2 | An active, unexpired **override** with `enabled` set → that value, source `override` |
| 3 | Else, if plan or add-ons mention `f` → `plan.enabled OR addon.enabled`, source `plan` / `addon` |
| 4 | Else → `f.default_enabled`, source `default` |
| 5 | **Limit** = override.limit → add-on `set` → (plan.limit if the plan lists `f`, else `f.default_limit`) **+ Σ add-on `add` × quantity**. `NULL` = unlimited |
| 6 | **Dependencies:** repeat until stable: if any `depends_on` is disabled, disable `f` (source `dependency`) |

Verified by the smoke test:

- Growth includes `learning.progress` but not `cohort.batches`.
- Pro's courses are unlimited.
- 2 × "+1,000 members" turns 2,000 into 4,000.
- Turning gamification off cascades to badges and leaderboards.
- Removing the override restores them.

## 3. Feature catalog (seeded in `99_seed_catalog.sql`)

| Module | Keys |
|---|---|
| core (always on) | `core.auth` `core.members` `core.roles` `core.branding` `core.media` `core.notifications` `core.audit` |
| site | `site.cms` `site.blog` `site.custom_domain` `site.remove_branding` `site.multi_language` |
| catalog | `catalog.courses` `catalog.bundles` `catalog.material_packs` `catalog.test_series` `catalog.reviews` |
| content | `content.video` `content.video_drm` `content.documents` `content.watermark` `content.downloads` `content.scorm`β `content.labs`β |
| learning | `learning.progress` `learning.drip` `learning.certificates` `learning.notes` |
| cohort | `cohort.batches` `cohort.syllabus_tracking` `cohort.content_release` |
| live | `live.classes` `live.attendance` `live.recordings` |
| assess | `assess.quizzes` `assess.question_bank` `assess.advanced_tests` `assess.proctoring`β `assess.assignments` `assess.analytics` |
| engage | `engage.gamification` `engage.badges` `engage.leaderboards` `engage.streaks` `engage.discussions` `engage.doubts` `engage.announcements` |
| comms | `comms.email` `comms.sms` `comms.whatsapp` `comms.push` |
| commerce | `commerce.checkout` `commerce.coupons` `commerce.installments` `commerce.subscriptions` `commerce.offline_payments` `commerce.gst_invoicing` `commerce.affiliates` |
| crm | `crm.leads` `crm.forms` |
| org | `org.branches` `org.parent_portal` `org.custom_roles` `org.custom_fields` |
| analytics | `analytics.basic` `analytics.advanced` `analytics.exports` |
| integrations | `integrations.api` `integrations.webhooks` `integrations.sso` |
| security | `security.device_limits` |
| ai | `ai.doubt_assistant`β `ai.question_generator`β |
| app | `app.pwa` `app.mobile`α |
| **limits** | `limit.members` `limit.staff` `limit.courses` `limit.branches` `limit.storage_gb` `limit.video_hours` `limit.emails_monthly` `limit.sms_monthly` `limit.whatsapp_monthly` `limit.ai_credits_monthly` |

Permissions are tied to features (`permission_catalog.feature_key`). The roles UI hides permissions of disabled features, and a permission is inert while its feature is off.

## 4. Example packaging (seeded; adjust prices freely)

| | **Starter – Study material** ₹1,499/mo | **Growth – LMS** ₹4,999/mo | **Pro – Academy** ₹14,999/mo | **Enterprise** custom |
|---|---|---|---|---|
| Branded site + CMS, courses, material packs, video, PDFs, checkout, coupons, email, PWA | ✓ | ✓ | ✓ | ✓ |
| Bundles, reviews, progress, drip, certificates, notes, quizzes, assignments, XP/badges/leaderboards/streaks, discussions, blog, custom domain, installments, push, live classes + attendance + recordings, leads | — | ✓ | ✓ | ✓ |
| Batches, faculty syllabus tracking, per-batch release, test series, question bank, advanced tests, proctoring, test analytics, doubts, learner subscriptions, offline fees, GST invoices, affiliates, branches, parent portal, custom roles/fields, advanced analytics, exports, SMS, WhatsApp, watermark, device limits, remove branding, webhooks | — | — | ✓ | ✓ |
| DRM, API, SSO, SCORM, labs, AI, mobile app, dedicated DB | add-on | add-on | add-on | ✓ |
| Members / staff / courses | 500 / 2 / 20 | 2,000 / 10 / 100 | 10,000 / 50 / ∞ | ∞ |
| Storage / video hours | 20 GB / 20 h | 100 GB / 200 h | 500 GB / 1,000 h | ∞ |

Add-ons: `members_1000`, `drm_video`, `whatsapp_5k`, `ai_assistant`. Distributors with `can_create_plans` can define their own plans and add-ons.

## 5. Enforcement in four places

| Layer | Mechanism | Purpose |
|---|---|---|
| **UI** | `<Feature flag="engage.leaderboards">…</Feature>`, nav items declare `feature:` | Hide what isn't on; render upsell cards in admin |
| **Routes** | Each route segment layout calls `await requireFeature('cohort.batches')` → `notFound()` (learner) or upsell page (admin) | No direct URL access |
| **Server (DAL / actions / API)** | Every service function starts with `assertFeature(ctx, key)` and `assertPermission(ctx, perm)` | The real gate |
| **Database** | RPCs check `private.feature_enabled()`; RLS gates some module tables (`feature_tenants('engage.leaderboards')`, discussions); **hard limits** via `private.enforce_count_limit` triggers on courses, members and branches | Defense in depth, race-safe limits (advisory lock) |

```ts
// packages/features/src/index.ts (sketch)
export type FeatureKey = (typeof FEATURES)[number]['key']          // generated from control.features
export const getFeatures = cache(async () => {
  const t = await getTenantContext()
  return loadEffectiveFeatures(t.id)        // 'use cache' + cacheTag(`tenant:${t.id}:features`)
})                                           // → Map<FeatureKey, { enabled, limit, config }>
export async function isEnabled(key: FeatureKey) { return (await getFeatures()).get(key)?.enabled ?? false }
export async function requireFeature(key: FeatureKey) { if (!(await isEnabled(key))) notFound() }
export async function limitOf(key: `limit.${string}`) { return (await getFeatures()).get(key as FeatureKey)?.limit ?? 0 }
```

**Limits UX:**

- Soft warning at 80% (banner in admin and an email to the owner).
- Hard stop at 100%. The DB raises `plan_limit_reached:limit.courses`, which the app maps to an upgrade dialog.
- Message quotas (SMS/WhatsApp/email) are checked before sending by the notification worker. Over quota, it falls back to in-app plus email and alerts the admin.

## 6. Code organisation per module ("toggleable by construction")

Each module is a vertical slice that can be absent without breaking anything:

```
packages/core/src/gamification/
  manifest.ts      ← { feature: 'engage.gamification', permissions: [...], nav: [...], events: { consumes, emits } }
  service.ts       ← business rules (assertFeature at top of every exported fn)
  queries.ts       ← DAL reads → DTOs
  actions.ts       ← server actions (zod-validated)
  handlers.ts      ← outbox event handlers (no-ops if feature off for the event's tenant)
apps/academy/app/[tenant]/(learn)/leaderboard/
  layout.tsx       ← await requireFeature('engage.leaderboards')
```

- Navigation, the admin settings tabs, the dashboard widgets and the event handlers are **assembled from manifests filtered by effective features**.
- Adding a module = adding a folder, a manifest and a feature row. No `if (tenant === 'x')` branching anywhere.

## 7. Beta rollouts & kill switches

- **Beta:** a feature in `lifecycle='beta'` is granted to selected tenants via overrides with an expiry.
- **Kill switch:** a platform-wide emergency disable (e.g. a WhatsApp provider outage) is `control.platform_settings['kill_switches'] = ["comms.whatsapp"]`, read by `getFeatures()` and AND-ed into every tenant without re-resolving entitlements.

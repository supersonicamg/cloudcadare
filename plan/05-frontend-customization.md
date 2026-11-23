# 05 · Frontend Customization — a different UI/UX per client

> Requirement: "prepare this application as a base, then for each client only modify the frontend and toggle services."
> Answer: **headless core, swappable skins.** Business logic, data, auth, features and APIs are identical for every client. What changes is presentation, and you choose how deep the change goes per client.

## 1. Four levels of customization

| Level | What changes | Who does it | Effort per client | Deploys |
|---|---|---|---|---|
| **L1 · Tokens & branding** | Logo, colours, fonts, radius, light/dark, favicon, OG image, footer, contact, SEO, terminology | Academy admin (UI) | Minutes | None (DB, cached) |
| **L2 · Page composition (CMS)** | Homepage and landing pages from blocks: hero, course grid, faculty, results/toppers, testimonials, pricing, FAQ, lead form, video, stats, CTA… Header/footer menus | Academy admin / your team | Hours | None (DB, cached) |
| **L3 · Theme package** | Whole look and feel: layout shells, typography scale, component styling, block designs, course page and dashboard layout, motion | Your team (code), selected per tenant | 1–3 weeks per theme, **reusable for many clients** | Shared academy app |
| **L4 · Custom app** | Anything: a bespoke learner site/app for one client. Unique UX, extra pages, different navigation model, even another framework | Your team (code), one client | 3–8 weeks | Separate Next.js app as a **zone** on the client's domain |

Most clients are served by L1 + L2 on a shared theme. Premium clients get a new L3 theme, which then becomes sellable to others. Flagship clients (possibly CloudCadre) get L4.

## 2. What is shared vs swappable

```
┌──────────────────────── NEVER forked (one copy, all clients) ────────────────────────┐
│ packages/core (domain services) · packages/db (schema, RLS) · auth · tenancy          │
│ features · permissions · integrations · sdk · workers · admin & instructor portals   │
└───────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────── Shared building blocks (used or replaced) ───────────────────┐
│ packages/ui (primitives, tokens) · packages/learner-kit (player, test engine, …)     │
│ packages/cms (block schemas + editor)                                                │
└───────────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────── Swappable per client ─────────────────────────────────────────┐
│ L1/L2: DB rows   ·   L3: packages/themes/<name>   ·   L4: apps/web-<client>          │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

**Why the admin and instructor portals are not per client:** they are complex, change often and must stay consistent for support and training. They take L1 branding (logo, primary colour) only. If a client insists, L4 can include a custom learner experience, but admin stays shared (served from the base zone, see §6).

## 3. L1 · Design tokens

`tenant_branding.tokens` (validated by Zod):

```json
{
  "mode": "system",
  "colors": { "primary": "#0F62FE", "primaryFg": "#FFFFFF", "accent": "#FF7A00",
              "bg": "#FFFFFF", "fg": "#0B1220", "muted": "#F3F5F9", "border": "#E3E8EF",
              "success": "#12B76A", "warning": "#F79009", "danger": "#F04438" },
  "dark":   { "bg": "#0B1220", "fg": "#E6EAF2", "muted": "#121A2B", "border": "#23304A" },
  "radius": "0.75rem",
  "font":   { "heading": "Plus Jakarta Sans", "body": "Inter" },
  "density": "comfortable"
}
```

- The root layout emits `<style>` with `:root{--color-primary:…}` and `[data-theme=dark]{…}`. Tailwind v4 `@theme` maps utilities to these variables, so `bg-primary` is tenant-coloured with no rebuild.
- **Fonts:**
  - The curated allow-list is self-hosted via `next/font/local` and preloaded per theme.
  - A custom upload is allowed (WOFF2 to `public-assets`, `@font-face`).
  - No arbitrary third-party CSS.
- **Contrast guard:** the admin colour picker computes WCAG contrast and auto-derives `primaryFg`. It blocks unreadable combinations.
- **Terminology** (`tenant_settings.terminology` merged over the vertical): `t('batch')` → "Cohort". This is used in every string, including emails.
- **No raw HTML/JS injection** (stored XSS and supply-chain risk). Analytics come in as typed IDs (GA4, Meta Pixel, GTM container id) rendered by vetted components. An escape hatch for custom head scripts is available only for dedicated/L4 clients via code review.

## 4. L2 · CMS blocks

A page = `site_pages.blocks` / `published_blocks` = an ordered array of `{ id, type, props }`.

- **Block contract** (`packages/cms`): each block type has a Zod `propsSchema`, editor metadata (fields, defaults, preview thumbnail), and data needs such as `course_grid` needing `catalog.getFeatured(limit)`.
- **Renderer contract:** every theme provides a component for every block type it supports; unsupported types fall back to the default theme's renderer. **Content is portable across themes**, so switching theme never loses content.
- **Feature-aware blocks:** `leaderboard_preview` requires `engage.leaderboards` and `batch_schedule` requires `cohort.batches`. The editor hides unavailable blocks, and the renderer skips them if a feature is later turned off.
- **Workflow:** edit draft (`blocks`) → preview (draft mode) → publish (copies to `published_blocks`, writes a `site_page_versions` row, `updateTag('tenant:{id}:page:{path}')`). Rollback is available to any version.

**Initial block library:**

| Group | Blocks |
|---|---|
| Hero | `hero`, `hero_video`, `hero_split` |
| Catalog | `course_grid`, `course_carousel`, `bundle_pricing`, `category_tiles`, `batch_schedule` |
| Trust | `faculty_strip`, `showcase` (results/toppers/testimonials), `stats_counter`, `partner_logos`, `press` |
| Content | `rich_text`, `image_text`, `video_embed`, `faq`, `timeline/roadmap` |
| Conversion | `cta_banner`, `lead_form`, `whatsapp_cta`, `demo_class_booking`, `pricing_table` |
| Engagement | `leaderboard_preview`, `blog_latest`, `announcement_bar` |

## 5. L3 · Theme packages

```ts
// packages/themes/contract.ts
export interface ThemeContract {
  key: string                                   // 'aurora'
  settingsSchema: z.ZodType                     // theme-specific options (e.g. heroStyle, cardStyle)
  fonts: FontSpec[]
  layouts: {
    SiteLayout: FC<{ nav: NavItem[]; footer: Footer; children: ReactNode }>
    LearnerLayout: FC<{ nav: NavItem[]; children: ReactNode }>        // dashboard shell
    AuthLayout: FC<{ children: ReactNode }>
  }
  pages: {                                      // optional overrides of page templates
    CoursePage?: FC<CoursePageProps>            // props are DTOs from @core – theme never fetches
    CatalogPage?: FC<CatalogPageProps>
    LearnerDashboard?: FC<DashboardProps>
    CheckoutPage?: FC<CheckoutProps>
  }
  blocks: Partial<Record<BlockType, FC<any>>>   // CMS block renderers
  components?: Partial<LearnerKitSlots>         // restyle learner-kit pieces (ProgressRing, BadgeCard…)
}
```

- Pages in `apps/academy` fetch data through `@core` and then render `theme.pages.CoursePage ?? DefaultCoursePage`. **Themes are pure presentation:** they receive DTOs and call server actions passed in as props. They never import `@core` or Supabase (lint-enforced).
- Themes are loaded with a static import map (`themes/index.ts`). Each is code-split, so a tenant only downloads its own theme.
- Visual regression: Storybook + Playwright screenshots per theme × block × light/dark × mobile/desktop in CI.
- A theme may declare `supported_features`. The console warns if a tenant's plan includes features the theme doesn't render well.

## 6. L4 · Custom client apps (multi-zones)

When a client wants a totally different experience, create `apps/web-<client>` (e.g. `apps/web-cloudcadre`):

- It is a normal Next.js 16 app in the monorepo. It depends on `@core/*`, `@learner-kit`, `@ui`, `@features`, `@auth` and `@tenancy`, so it gets every domain capability, feature toggle and security rule for free.
- It is **pinned to one tenant** with `TENANT_ID` in env, and tenancy resolves from env instead of host.
- It is deployed as its own Vercel project and registered in `control.frontend_templates` (`kind='custom_app'`, `deployment_url`). The tenant (or one domain) points `frontend_template_key='custom:cloudcadre'`.
- It is served on the client's domain using **Next.js multi-zones**:
  - The custom app owns the learner and marketing paths: `/`, `/courses/*`, `/learn/*`, `/blog/*`…
  - The base `apps/academy` zone keeps `/admin/*`, `/instructor/*`, `/auth/*`, `/api/*`, `/verify/*` (certificates) and `/checkout/*` if the custom app doesn't implement it.
  - Routing is done by `rewrites` in the custom app (or in the base app's proxy), and each zone sets its `assetPrefix` to avoid asset clashes.
  - Navigation across zones is a hard navigation, so zones are split along natural boundaries (learner vs admin).
- It can use a different design system, animation library or even a different framework for marketing pages, while still calling the same server actions and REST v1.

```ts
// apps/web-cloudcadre/next.config.ts (sketch)
const nextConfig: NextConfig = {
  assetPrefix: '/cc-static',
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return { beforeFiles: [
      { source: '/admin/:path*',      destination: `${process.env.BASE_ZONE_URL}/admin/:path*` },
      { source: '/instructor/:path*', destination: `${process.env.BASE_ZONE_URL}/instructor/:path*` },
      { source: '/auth/:path*',       destination: `${process.env.BASE_ZONE_URL}/auth/:path*` },
    ] }
  },
}
```

**Guardrails for L4:**

- Custom apps may not talk to Supabase with the secret key, and may not add tables. If the client needs new data, it becomes a **module in core** behind a feature flag, so it is reusable and stays secure.
- Pin `@core` and the other workspace packages to the monorepo version. CI builds every app on every core change, so a breaking change in core fails the custom app's build, not production.
- Contract tests: each custom app runs the shared Playwright "learner journey" suite (signup → buy → learn → test → certificate) against its own UI via test IDs provided by learner-kit.

## 7. learner-kit: the hard parts, built once

Complex functional UIs are built once, headless-first, so every theme or custom app reuses the behaviour and restyles the look:

| Component | Headless hook | Behaviour included |
|---|---|---|
| VideoPlayer | `useLessonPlayer(lessonId)` | Signed playback, resume position, heartbeat to `record_lesson_progress` (15 s + `sendBeacon`), speed control, captions, dynamic watermark (name/phone, moving), notes at timestamp |
| PdfViewer | `useDocument(lessonId)` | Signed URL, page tracking, watermark overlay, download policy |
| TestEngine | `useTestAttempt(testId)` | `start_test_attempt` → `get_attempt_paper`; server-clock countdown (drift-corrected); section navigation; mark-for-review palette; autosave each answer with retry queue + IndexedDB backup; fullscreen/tab-switch proctor events; auto-submit at deadline; result view per visibility rules |
| CurriculumTree | `useCurriculum(courseId)` | Nested sections, lock reasons (drip date, prerequisite, batch release), progress ticks |
| Progress widgets | `useMyProgress()` | Course %, days enrolled, active days, streak heatmap, time spent |
| Gamification | `useMyStats()`, `useLeaderboard(key)` | XP bar, level, badges grid, leaderboard with "you" pinned, realtime toast on award |
| LiveClassCard | `useLiveSession(id)` | Countdown, join button (enabled X min before), recording playback |
| Checkout | `useCheckout(productId)` | Price/installment selection, coupon apply, GST breakdown, Razorpay/Stripe launch, success polling |
| Doubts | `useDoubts(context)` | Ask with image/LaTeX, status, notifications |

## 8. Playbook: onboarding a client with a custom look

1. **Discovery:** brand assets, reference sites, must-have pages and journeys. Decide L1/L2/L3/L4.
2. **L1/L2 first** (always): set tokens and build the homepage from blocks. Often enough.
3. **L3:** fork `packages/themes/default` → `packages/themes/<name>`, implement the contract, and add Storybook stories plus visual snapshots. Register it in `frontend_templates` and assign it to the tenant.
4. **L4:** `pnpm turbo gen custom-app <client>` scaffolds `apps/web-<client>` with tenancy pinned, the zone config, the learner-kit wiring and the contract tests. Then create the Vercel project and register `custom:<client>`.
5. **QA:** run the shared journey suite, Lighthouse (performance budget LCP < 2.5 s on 4G), accessibility (axe) and visual review.
6. **Go live:** domain verification → set primary → monitor.

## 9. CloudCadre recommendation

Start CloudCadre on **L1 + L2 with a polished theme** (built as `aurora`, a modern tech look suited to cloud training). Use it to validate the product. If they want a signature experience, build `apps/web-cloudcadre` as an L4 zone in Phase 4. The content, data and admin carry over untouched.

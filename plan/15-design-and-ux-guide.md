# 15 · Design and UX guide (CloudCadre) — version 11

> **Who this is for:** any AI agent or developer building a CloudCadre screen, marketing or app.
> Read it fully before any UI work. It is the single source of truth for how CloudCadre looks, reads and behaves.
>
> | | |
> |---|---|
> | **Guide version** | **11.1**, 2026-11-26 (11 plus the owner's phone changes: hiding navbar, sliding rows) |
> | **Reference build** | [`plan/mockups/home-v11.html`](mockups/home-v11.html). Open it in a browser. Toolbar: **Desktop / Tablet 820 / Phone 390** and **Design notes**. **Its phone view is out of date:** for phones follow §8 and `packages/themes/aurora/src/phone.css` |
> | **Replaces** | Version 9 (teal + Schibsted Grotesk, rounded inset panels, slanted frame). Archived at [`plan/archive/15-design-and-ux-guide-v9.md`](archive/15-design-and-ux-guide-v9.md) |
> | **History** | §19 lists every version and the mockup file behind it |
>
> When a rule here is unclear, copy what `home-v11.html` does. Where any older mockup (`homepage-v9.html`, `plan/mockups-learner-flows/`, files in git history) disagrees on **visuals**, this guide wins. Older mockups are still valid for **structure**: which screens exist, what is on them, which states they need.
>
> **The app is partly on v11.** The home page, header, footer and font were ported on 2026-11-26 (§16 steps 1, 3, 4). The catalog and course pages, tenant branding tokens and the learner area are still open (§16).

---

## 0. The rules that override everything else

1. **Picture, number, line.** Every unit on a marketing screen is one picture (real face, photo or code-drawn diagram), one big value, and one short line. No paragraphs. This is the formula of the placement card, the one section the owner loved; every other section was rebuilt to match it (§3).
2. **Clear in 5 seconds.** A first-time visitor must be able to say what this is, who it is for, when it starts and what it costs from the first screen. The H1 names the thing in plain words, not a slogan.
3. **Hierarchy first, styling second.** For every section write down its job, its reading order and its one main action before choosing anything visual.
4. **One filled button per view.** Everything else is an outline button or a text link.
5. **Images must carry information.** A real learner, the thing you build, the timetable. Decoration never. People skip decorative and stock people photos and study real ones ([NN/g](https://www.nngroup.com/articles/photos-as-web-content/)).
6. **Real proof beats claims.** The 15 real placements are the strongest content on the site. Use real people, real numbers and real employer logos before any sentence about quality.
7. **Every section is its own region.** Two sections that touch never share a background (§4).
8. **Human-made, not AI-made.** Nothing from the banned list (§2), ever.
9. **Two jobs on every marketing page:** (a) see the program or join it, (b) WhatsApp a real person. Nothing else is pushed.
10. **Honest.** Never promise a job. Mark every invented number, name, photo or price as a placeholder in code comments and in §17.
11. **Phone and tablet are designed, not shrunk.** They get their own patterns (§8). Nothing may overflow sideways.

---

## 1. Product context

- **CloudCadre** is a cloud training academy, the first client of the EduCore platform. The site is themed by `packages/themes/aurora`.
- **It sells one program for now:** the **CloudCadre Elite Architect Program (CEAP)**: 4 months, live online, AWS, Azure, Google Cloud, FinOps, Terraform, Docker, Kubernetes and CI/CD, ending with a capstone, mock interviews and CV help.
- **More programs may come later.** List pages must work with one item today and many later. Never show an empty catalog.
- **Brand name:** "CloudCadre" on every surface. The program is "CloudCadre Elite Architect Program" or "CEAP". Never "CloudEdufy".
- **Audience:** Indian learners: freshers, IT professionals (support, sysadmin, developers), and career switchers from finance or ops. Many read English as a second language.
- **The real edge is FinOps.** 9 of the 15 real placements are FinOps roles. Keep FinOps visible in headlines and the program.
- **Money and dates:** ₹, LPA, UPI, monthly instalments. Write dates like "12 Jan".
- **Real data available:** 15 placements (name, photo, package, role, company) and 7 employer logos in `apps/academy/lib/aurora-content.ts` and `apps/academy/public/cloudcadre/logos/`. Confirm each learner's consent before launch.

---

## 2. Banned: what makes a page look AI-made or childish

**Never use any of these.** The owner rejected each one.

| Banned | Use instead |
|---|---|
| Gradient text, aurora or blurred colour blobs, glow, neon | Flat solid colour |
| Glassmorphism, frosted panels, floating or overlapping cards | Solid surfaces on the grid; text on a photo sits on a bottom scrim, inside the photo |
| Fake dashboards, terminal windows, progress rings as decoration | A code-drawn diagram of what the learner builds (§11) |
| Pill badges with pulsing dots, avatar stacks, "10,000+ students" bars | Real counted numbers next to real faces |
| Eyebrow or kicker labels above the H1 | Let the H1 say it |
| Monospace or letter-spaced ALL-CAPS labels | Sentence-case labels, 14px, regular weight, muted colour |
| Emoji | Nothing, or a real logo |
| Arrows inside buttons ("Join →") | The verb is enough |
| Several filled buttons competing | One filled button per view |
| Big round corners (8px and up), pastel card tints, chunky 700–800 weights | 3–4px corners, one neutral tint, weights 400 and 600 only |
| Yellow highlighter bars on headline words, teal-coloured headline phrases | One colour per headline |
| Swooshes, waves, diagonal stripes, 3D shapes, the slanted frame on pages | Straight edges (the slant now lives only in the logo mark) |
| Paragraphs, benefit lists, "What you get" blocks, 3-column text sections | Picture + number + line units (§3) |
| Stock photos of "a fresher" or "a professional" as persona cards | Drop the section, or show real people |
| Chips and pill buttons (quick-reply chips, tool chips with borders) | One clear action; logos without boxes |
| Grey-to-colour hover effects, hover lift on things that are not links, photo zoom on hover | No hover effect on static content |
| Marquees and carousels on wide screens; on phones, a sliding row with no card peeking in, a self-sliding row that cannot be stopped, or the price or main action inside a row | A grid on wide screens; the phone rows in §8 |
| Hamburger menu on phones | A visible row of 4 links (§8) |
| A full-width yellow "Next batch" band | The batch ticket (§10.8) |
| AI-generated photos of people | Real CloudCadre people; stock only as a marked placeholder |
| Grey "image goes here" boxes in mockups | A real stand-in photo, marked as placeholder |

**The opposite also fails.** A plain white, text-heavy "editorial minimal" page was rejected twice (v10 included). Warmth comes from real faces, photos, big numbers and the saffron button, not from decoration.

---

## 3. The core pattern: picture, number, line

The placement card is the model for every unit on a marketing screen:

```
┌──────────────┐
│   picture    │  real face / photo / code-drawn diagram (carries information)
├──────────────┤
│ ₹27 LPA      │  one big value (H3 or Number role)
│ Monika Singh │  one name or title (600)
│ Sr PM, NICE  │  one short line (Small role, muted)
│ [logo]       │  optional: a logo instead of a word
└──────────────┘
```

How v11 applies it:

| Section | Picture | Big value | Line |
|---|---|---|---|
| Hero | A real learner, full height | "₹27 LPA" on the photo's scrim | Name, role, company |
| Placements | Learner photo, square | "₹27 LPA" | Name, role, logo |
| Program | Diagram of what you build that month | Month title | "Month 1 · 12 labs" and one line |
| How classes work | Class photo | "30", "34", "1", "2" | "seats in a batch" … |
| Next batch | Calendar date, weekly timetable | "12", "₹80,000" | "first instalment" |

**Text budget per marketing section:** one H2, at most one short line under it, and at most 12 words per unit. If a section needs more, it belongs on another page (the program page, the syllabus PDF) or behind a tap.

---

## 4. Page structure and surfaces

Sections are **full-width bands**. No inset panels, no rounded section blocks.

| Surface | Colour | Use |
|---|---|---|
| **Dark** | `#0C1312` | Header, hero, one mid-page band ("How classes work"), footer |
| **White** | `#FFFFFF` | Content sections |
| **Paper** | `#F5F4F0` | Collections of white cards (placements), the batch ticket |

**Rhythm:** two touching sections never share a surface. Alternate dark / paper / white. Header and hero are both dark and read as one unit; that is the only allowed touch.

**Home page order (v11):**

| # | Section | Surface | Job |
|---|---|---|---|
| — | Sticky header (+ link row on phone and tablet) | dark | Navigate, WhatsApp |
| 1 | Hero: H1, one line, 3 facts, Join + WhatsApp, real learner photo | dark | Say what this is; start |
| 2 | Where our learners work now (15 real cards + logos) | paper | Prove it works |
| 3 | What you build in 4 months (4 month cards) | white | Show the program |
| 4 | How classes work (4 number tiles) | dark | Show how it's taught |
| 5 | Next batch (ticket: date, week, fee, Join) | paper | When and how much; join |
| 6 | Questions before you join (FAQ + counsellor) | white | Remove doubts; talk to a person |
| — | Footer | dark | |

Section order on any marketing page follows the visitor's questions: **what is it → does it work → what will I learn → how → when and how much → my doubts.**

---

## 5. Colour

Palette name: **Ink + saffron**.

| Token | Hex | Use |
|---|---|---|
| `--dark` | `#0C1312` | Dark surfaces, the text on a saffron button |
| `--dark-2` | `#16201E` | Image placeholders on dark |
| `--ink` | `#0F1716` | Headings and strong text on light surfaces, 1px strong rules |
| `--body` | `#3A4240` | Body text and lead lines |
| `--muted` | `#5F6764` | Labels, meta, small print (the lightest text allowed) |
| `--paper` | `#F5F4F0` | Paper surface |
| `--tile` | `#EEEDE8` | Diagram backgrounds, empty timetable cells |
| `--rule` | `#DCDAD3` | Hairlines, card and tile borders |
| `--acc` (saffron) | `#F2B33D` | **The one filled button**, the one highlighted element in a diagram, the lab cell in the timetable, the focus ring |
| `--acc-h` | `#FFC25A` | Saffron button hover |
| on-dark text | `rgba(255,255,255,.82)` / `.64` | Secondary / tertiary text on dark |
| on-dark rule | `rgba(255,255,255,.16)` | Hairlines on dark |
| WhatsApp green | `#128C4A` | The WhatsApp glyph in the phone action bar only |

**Rules:**
- Neutrals carry about 95% of every screen. Saffron appears on the one filled button and at most one more spot per view.
- Saffron is never text colour and never a section background.
- Text contrast at least 4.5:1. Saffron with ink text passes; white text on saffron does not, so never use it.
- **Platform tokens:** set CloudCadre's tenant branding to primary `#0C1312`, accent `#F2B33D`, bg `#FFFFFF`, muted `#F5F4F0`, border `#DCDAD3`, through `tenant_branding.tokens`. Don't edit the platform defaults in `packages/ui/src/tokens.ts`.

---

## 6. Type

**One family: Hanken Grotesk. Two weights: 400 and 600.** Nothing else, anywhere. No 500, 700 or 800, no second family, no monospace. In the app load it with `next/font`.

Eight roles. Every piece of text on a page uses exactly one of them.

| Role | Size | Weight | Line height | Letter spacing | Colour | Use |
|---|---|---|---|---|---|---|
| **Display** | `clamp(40px, 4.8cqi, 66px)` | 600 | 1.02 | −0.034em | ink / white | The H1, one per page |
| **H2** | `clamp(28px, 3cqi, 40px)` | 600 | 1.1 | −0.025em | ink / white | Section titles |
| **Number** | `clamp(28px, 2.6cqi, 36px)`; 36–48px in number tiles and the fee | 600 | 1.0 | −0.03em | ink / white | Big values: ₹ LPA, 30, ₹15,000. The calendar day is the one exception at `clamp(72px, 7cqi, 104px)` |
| **H3** | `clamp(19px, 1.5cqi, 21px)` | 600 | 1.3 | −0.01em | ink | Card titles, card values, facts values |
| **Lead** | `clamp(17px, 1.4cqi, 19px)`, max 44ch | 400 | 1.5 | 0 | body | The one line under the H1 or an H2 |
| **Body** | 17px (16px on phones) | 400 | 1.55 | 0 | body | FAQ answers, app text |
| **Small** | 15px | 400 (600 for a name) | 1.45 | 0 | muted | Card lines, captions, meta |
| **Label** | 14px | 400 | 1.4 | 0 | muted | Field and fact labels ("Next batch", "Month 1 · 12 labs") |

**Rules:**
- Hierarchy comes from size **and** weight **and** colour together: a value is 600 ink, its label is 400 muted.
- `text-wrap: balance` on Display and H2.
- Sentence case everywhere. No ALL CAPS, no letter-spacing on small text.
- A unit of value plus unit ("₹27 LPA", "₹15,000 / month") shows the unit in Label size, 400, muted.
- The H1 is at most 8 words. It names the category or the outcome, in plain words: "Become a cloud engineer in 4 months."

---

## 7. Layout, spacing and shape

| Thing | Value |
|---|---|
| Page width | `max-width: 1440px`; side gutter `clamp(16px, 4cqi, 56px)` |
| Section padding | `clamp(64px, 8cqi, 112px)` top and bottom |
| Section head to content | `clamp(24px, 3cqi, 40px)` |
| Grid gaps | 16px between cards (10px on phones); 32px between tiles with captions |
| Spacing scale | Multiples of 4: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 |
| Radius | **3px** for cards, photos, buttons and tiles; 50% only for round avatars |
| Shadows | None, except the phone action bar (`0 -6px 20px rgba(0,0,0,.06)`) |
| Rules | 1px `--rule` between items; 1px `--ink` as a strong top rule (FAQ list); dashed `--rule` inside the batch ticket |

**Section head:** H2 on the left, an optional Lead line under it, an optional text link on the right ("Full syllabus (PDF)"). Nothing else.

**Grids:** use explicit column counts that divide the content evenly: 4 → 2 for four items, `auto-fill, minmax(220px, 1fr)` for the placement wall (5 per row at full width, so 15 makes 3 full rows). Never leave a single orphan card on a row.

---

## 8. Responsive: components, not breakpoints

**The approach.** Every section is a container (`container-type: inline-size`) and changes its layout from its own width, not the device's. Type and space are fluid (`clamp` with `cqi` units), so nothing jumps. Only real structure changes get a container query. Check every screen at **1440, 820 and 390** wide.

| Component | Wide | ≤ 900px | ≤ 560px (phone) |
|---|---|---|---|
| Header | Logo, 4 links, Log in, "WhatsApp us" | Links move to a **visible link row** under the header | WhatsApp becomes a 44px icon button; header and link row **hide on scroll down, return on scroll up** |
| Hero | Copy left, photo right (50/50) | Copy first, photo below at 4:3 | Photo first (25svh) fading into the H1; two facts side by side, the money fact on its own row; buttons full width |
| Placement wall | 5 per row | 3 per row | **Self-sliding row** of all 15, 232px cards, "Pause sliding" |
| Month cards | 4 per row | 2 per row | **Swipe row**, snapping, card 82cqi, all lines shown |
| Number tiles | 4 per row | 2 per row | **Self-sliding row**, card 68cqi, "Pause sliding" |
| Batch ticket | Date · week · fee in 3 columns | Date + week, fee below | Stacked; the week is seven colour markers and two lines ("Live class · Sat–Sun, 11 am to 2 pm") |
| FAQ + person | Person left, FAQ right | FAQ first, person after | FAQ first; person as a 64px round face, name and one button |
| Footer | 4 columns | 2 columns | 2 columns |

**Phone patterns (researched, keep them).** The phone is its own design, kept in `phone.css`, not the wide page squeezed.
- **No hamburger.** With 4 main links, keep them visible in a row of equal tabs under the header. Hidden navigation is found less often ([NN/g](https://www.nngroup.com/articles/hamburger-menus/)).
- **Hiding navbar** (`@educore/ui/auto-hide`, public pages and the learner area): hides after a few pixels of scroll down, returns on a few pixels up, 0.3s ([NN/g](https://www.nngroup.com/articles/sticky-headers/)). It stays while the keyboard focus or an open menu is inside it, and steps aside when an in-page link is tapped.
- **Sliding rows instead of squeezed grids** (owner, 26 Nov 2026). Full bleed, one card and a good part of the next, so it is plain there is more ([NN/g](https://www.nngroup.com/articles/mobile-carousels/)). Every row can be swiped.
  - **Self-sliding** only for things that can be glanced at in any order (placements, number tiles): about 36px a second, loops, waits while touched, has a "Pause sliding" button ([WCAG 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)), and does not move by itself with reduced motion or without JavaScript.
  - **Swipe and snap** for things read in order (months).
  - Never put the price, the date or the one filled button inside a row.
- **The first screen holds the H1, the facts and the Join button**, checked down to 360×640. The photo above the H1 is short enough to keep that true.
- **Sticky action bar:** a slim white bar at the bottom ("Start with ₹80,000" · WhatsApp icon · "Join batch"). It appears only after the hero button scrolls away and hides once the batch section is reached. Show it on phones only.
- **Progressive disclosure:** when a unit has detail that doesn't fit, hide it behind a text-button toggle with `aria-expanded` ("Topics and project"), never behind a hover.
- **Targets:** at least 44px tall. Main buttons are full width on phones. Hover styles only where there is a pointer (`@media (hover: hover)`); touch gets a pressed state.

---

## 9. Motion

Almost none. The page must work and look finished with no animation.

| Motion | Spec |
|---|---|
| Button hover | Background colour change only |
| Phone action bar | Slide up `translateY(110%) → 0`, 0.25s |
| Swapping content in place | Opacity fade, 0.2–0.3s |
| Phone navbar | Slide `translateY(-100%)`, 0.3s |
| Phone self-sliding rows | About 36px a second; "Pause sliding"; off with reduced motion |
| Diagram connectors | May flow slowly (`stroke-dashoffset`, 1s loop); optional |

No reveal-on-scroll, no hover lift, no photo zoom, no marquee on wide screens. **Everything is off under `prefers-reduced-motion: reduce`.**

---

## 10. Components (all in `home-v11.html`)

### 10.1 Buttons and links

| Type | Look | When |
|---|---|---|
| **Filled** (`.btn`) | Saffron, ink text, 600, 52px tall (48px in the phone bar), radius 3 | The one main action of the view |
| **Outline** (`.btn.btn-line`) | 1px ink border, ink text; fills ink on hover | The second action ("Message Ananya", "Show all 15 learners") |
| **Text link** (`.link`) | 600, underlined (offset 5px), optional WhatsApp glyph before | "Ask on WhatsApp", "Full syllabus (PDF)" |

Labels are a verb plus an object: "Join the 12 Jan batch", "Ask on WhatsApp", "Message Ananya". No arrows, no "Click here", no "Submit".

### 10.2 Header
- Dark, sticky, 64px (56px on phones), 1px on-dark rule at the bottom.
- Logo mark + "CloudCadre" (600, 19px) · links: Placements, Program, Fees and dates, FAQ · right: "Log in" and an outline "WhatsApp us".
- At ≤ 900px the links move to the **link row**: 4 equal tabs, 44px tall, on dark, under the header (it scrolls away; only the header row is sticky).

### 10.3 Hero (split, real learner)
- Left, on dark: Display H1 → one Lead line → **facts row** → filled "Join the {date} batch" + WhatsApp text link.
- **Facts row:** 3 items, each a Label ("Next batch") over an H3 value ("12 Jan"). Values must be the answers to when, what time and how much.
- Right: a **real learner's photo**, full height, `object-fit: cover`, with a bottom scrim (`linear-gradient(180deg, transparent, rgba(8,12,12,.88) 70%)`). On the scrim: "₹27 LPA" (Number, white), then "Name, CloudCadre learner · Role, Company" (Small).
- Only with the learner's written consent. Until then a stock photo, marked.

### 10.4 Placement card and wall (the model component)
- White card, radius 3, on the paper surface. Square photo (`c_fill,g_face` crop from Cloudinary), then: "₹27" in H3 + "LPA" in Label → name (Small, 600) → role (Label, muted, 2 lines reserved) → company **logo** (17px tall, max 92px wide) or the company name in 600 when there is no official vector logo. Never scraped favicons.
- The section head shows counted numbers ("**15** learners · **12** companies · up to **₹29 LPA**") and the employer logos in grey. Count from the list; never an average of hand-picked stories.
- Footnote: "Packages are CTC per year, as shared by each learner."
- Only real, consented placements go live. No "Was / Now" unless the previous job is known.

### 10.5 Month card (program)
- Paper card, radius 3. On top a **diagram** (8:5, on `--tile`, §11) showing what you build that month.
- Then a Label "**Month 1** · 12 labs" → H3 title of what you build ("One app on three clouds") → one Small line (the topics in 6 words).
- 4 cards = 4 months. The full syllabus lives in a PDF and on the program page, not on the home page.

### 10.6 Number tile ("How classes work")
- Photo 4:3, radius 3 → big Number ("30") → one Small line ("seats in a batch"), 3–4 words.
- Four tiles. Each number must be specific and true (or marked placeholder).

### 10.7 Facts
A value is always H3/600 ink with a Label/400 muted above it. Use for the hero facts, the batch details and app summaries.

### 10.8 Batch ticket ("Next batch")
One white block on paper with three parts separated by dashed rules:
1. **Calendar:** month and year (Small, 600) → the day as a huge numeral → "4 months, live online" (Label).
2. **Your week:** a 7-day row (Mon–Sun). Class days are ink cells ("11 am / 2 pm"), practice days are saffron cells ("10 am / 5 pm"), free days are `--tile` with "–". A legend under it, plus "Every class is recorded".
3. **Fee:** "Start with" → "₹80,000" (Number) + "first instalment" (Label) → "UPI, card, net banking" → the filled Join button → WhatsApp text link.
This is where the price lives on the home page. Never hide the price behind "ask us".

### 10.9 FAQ and counsellor
- **Person:** a real photo (4:3, radius 3), name (600), "Admissions counsellor · replies in about 15 min" (Small), one **outline** "Message {name}" WhatsApp button. Nothing else (no chips, no example chat).
- **FAQ:** native `<details>`, all closed, 1px ink top rule, 1px hairlines, question in Body/600, "+" / "–" on the right. 5–6 questions, answers of at most 2 sentences. Must include "Do you guarantee a job?" answered honestly (no).

### 10.10 Phone action bar
See §8. White, 1px top rule, soft shadow. Left: "Start with ₹80,000" (Small, 600) over "First instalment · 12 Jan batch" (Label). Right: a 48px WhatsApp icon button and a filled "Join batch". Its links are `tabindex="-1"` and `aria-hidden` while it is hidden.

### 10.11 Footer
Dark. Logo + one line ("Live online training in cloud, DevOps and FinOps.") · Program · Help · Contact columns · bottom rule with the trademark line and Privacy · Terms · Refunds.

### 10.12 Logo
- **Mark:** [`plan/mockups/assets/cloudcadre-mark.svg`](mockups/assets/cloudcadre-mark.svg) (the slanted panel "C"). **Wordmark:** "CloudCadre" typed in the site font, 600.
- **Open question:** the mark is still teal + yellow from the v9 palette. Ask the owner whether to recolour it to ink + saffron (§17).

---

## 11. Diagrams

Diagrams are **built in code (inline SVG), never generated images**: generated images can't show an exact claim, don't match each other and garble labels.

- `viewBox="0 0 320 200"`, shown at 8:5 on a `--tile` background.
- Lines `#0F1716`, stroke 1.5. Tiles white with a `--rule` border, radius 3. Arrows use one shared marker.
- **Exactly one saffron element** per drawing: the thing that matters (the "After" bar, the capstone block).
- **Real tool logos** inside white tiles (Devicon via the shared sprite `packages/ui/src/sprite.ts` in the app; jsDelivr in mockups).
- Labels in the site font, 12–13px, ink or muted. Each label is also in the card's text or the SVG's `aria-label`.
- Each drawing shows its claim literally: "One app on three clouds" = one app box wired to AWS, Azure and Google Cloud; "A smaller cloud bill" = Before and After bars; "Code to Kubernetes" = Code → Terraform → Docker → Kubernetes; "Design it, defend it" = your architecture → panel review → 2 mock interviews.
- No invented numbers inside drawings (no "−32%") unless confirmed.

---

## 12. Photography

- **Best:** real CloudCadre people: placed learners (with consent), live classes, trainers, the counsellor. Plan one photo session.
- **Real learners lead.** The hero uses a real learner photo. Stock is only a marked placeholder (`<!-- stock placeholder -->`).
- **Stock rules (placeholders only):** natural, warm, real workplaces; no posed models, no handshakes; prefer people who look Indian.
- **No AI-generated people, ever.**
- **Framing:** radius 3, `object-fit: cover`. Text on a photo only on a bottom scrim inside the photo.
- **Alt text** describes the photo. Faces next to a printed name use `alt=""`.
- **Known issue:** several placement photos carry a small AI-tool sparkle mark in one corner, and Shubham Kulkarni's photo shows three people. Ask for clean originals.

---

## 13. Writing

- **Clear first:** the H1 names the thing; facts answer when, what time and how much.
- **Short:** at most 12 words per unit; one line under a heading; FAQ answers at most 2 sentences.
- **Outcome first:** "One app on three clouds", not "Introduction to multi-cloud".
- **Specific:** weeks, labs, dates, names, ₹. No "world-class", "cutting-edge", "unlock your potential", "transform your career".
- **Sentence case** for every heading, button and label.
- **Plain English** for second-language readers; no idioms.
- **Honest:** no job guarantee, no fake urgency. Placeholders are marked in code and listed in §17.

---

## 14. Accessibility (must pass)

- **Focus ring:** `outline: 3px solid #F2B33D; outline-offset: 3px` on every interactive element.
- **Targets:** at least 44×44px.
- **Contrast:** at least 4.5:1 for text. `--muted` is the lightest text on white or paper.
- **Semantics:** one H1, headings in order, sections labelled by their H2 (`aria-labelledby`), lists as `ul`/`ol`, FAQ as `<details>`, toggles with `aria-expanded`.
- **Diagrams:** `role="img"` and an `aria-label` that states the claim.
- **External links** (`wa.me`) use `target="_blank" rel="noopener noreferrer"`.
- **Reduced motion** respected; content fully visible without JavaScript.

---

## 15. How to build any new screen

1. **Find its structure** with `node scripts/track.mjs` (the `mockup` field) or `plan/mockups-learner-flows/`. Take structure and states from there; take every visual from this guide.
2. **Write the brief** as a comment: the screen's one job, its one filled action, the visitor's questions in order, and which surface each section uses (§4).
3. **Build units, not paragraphs.** For each section ask: what is the picture, what is the big value, what is the one line (§3)? If there is no picture, use facts (§10.7) or a diagram (§11).
4. **Pick components from §10.** Make a new one only when none fits, using the tokens in §5–7.
5. **Lay it out with containers** (§8) and check at 1440, 820 and 390 wide.
6. **Run the checklist** in §18.

### Page recipes

| Route | Job | Structure (in v11 units) |
|---|---|---|
| `/courses` (catalog) | Send people to CEAP while it's the only program | Redirect to the program page, or one program card (diagram + title + facts). With 2+ programs: month-card-style program cards, logos as filters, no prices on cards |
| `/courses/[slug]` (program page) | Help someone decide | Split hero (H1, facts with price, Join) → month cards, each expanding to full topics → number tiles → placement wall (filtered to this program) → batch ticket → FAQ + person |
| `/checkout/[orderId]` | Pay with confidence | Focus layout (logo only). Order summary as facts (program, batch date, price, instalments) beside the payment block. One filled "Pay ₹…" button, WhatsApp help line |
| `/login`, `/signup` | Get in fast | Split: real-learner photo with the ₹ LPA scrim on one side (hidden on phones), form on the other. One filled button |
| Learner area (`/learn` and the app frame) | Resume, then learn | Same tokens, type roles and 3px radius. Home: Continue card (one filled button) → next class → your months. Denser layouts are fine; still no paragraphs where a fact or progress number works |
| Lesson | Learn without distraction | Focus layout, content first, one big forward button |
| `/progress`, `/certificates`, `/verify/[code]` | Show proof | Big Numbers for progress; the certificate as a code-drawn card; verify as a plain facts page (name, program, date, valid) |
| `/admin/*` | Get work done | Functional UI on the same tokens, type and focus ring. Tables are fine. No marketing patterns |

---

## 16. Porting v11 into the app

**Done 2026-11-26:** step 1 (Hanken Grotesk, `font.ts`), step 3 (home in `home.tsx`, `home.css`, `diagrams.tsx`; content keys in `aurora-content.ts`) and step 4 (header with link row, phone action bar, footer in `site.css`; the floating WhatsApp button is gone). The home page uses fixed v11 hex values in `site.css`, not tenant tokens, so step 2's branding tokens are still open, and so is step 5. The catalog and course pages still use the v9 `.au` rules in `aurora.css`. Steps as originally written:
1. **Font:** swap Schibsted Grotesk for Hanken Grotesk (400, 600) in `packages/themes/aurora/src/font.ts`.
2. **Tokens:** set the tenant branding values in §5; replace aurora CSS radii (12–36px) with 3px; drop inset panels, the slanted hero frame, the yellow marker and reveal animations.
3. **Home:** rebuild `packages/themes/aurora/src/home.tsx` and `home.css` to the v11 order (§4). Content keys in `apps/academy/lib/aurora-content.ts`: the hero gets a `learner` (photo, package, name, role, company); `program.months` gets a `diagram` id and a short `line`; `how.tiles` becomes number tiles; `talk.nextBatch` grows into the batch ticket (date, week, fee). Remove `builtFor` and the climb from the home page.
4. **Header:** replace the phone "Menu" dropdown with the link row; add the phone action bar; remove the floating WhatsApp button.
5. **Learner area:** keep its structure (session of 2026-11-26), move it to the v11 tokens and type roles.
6. Update `plan/tracker.json` and PROGRESS.md as each step lands.

---

## 17. Open placeholders and questions (resolve before launch)

- **Batch and price:** the date "12 Jan", seats (30). Class times (Sat–Sun 11 am–2 pm), practice (Mon–Fri 10 am–5 pm) and the first instalment (₹80,000) came from the owner on 26 Nov 2026; the total fee and later instalments are not given yet. `courseInstalments` in `aurora-content.ts` makes the course page and checkout call CEAP's database price the first instalment and hides its struck ₹95,000. Paying it opens the whole course: collecting the rest is manual.
- **Program:** the month split, topics, lab counts (12 / 8 / 14 / "34 labs"), and a real syllabus PDF.
- **People:** the counsellor's name, photo and hours; the WhatsApp number, phone and email.
- **Consent:** every placement learner, and Monika Singh for the hero photo.
- **Photos:** all class photos are stock; clean versions of the placement photos (no sparkle mark, one person each).
- **Logo:** recolour the mark to ink + saffron, or keep teal + yellow? (owner)
- **Logos:** official vector logos for NICE, Cencora, Truetech, Fabutech and SA Technologies.
- **Certificate:** the existing image prints "CloudEdufy" and must be redrawn.

---

## 18. Before you hand a screen over

- [ ] A stranger can tell what this screen is and what to do in 5 seconds.
- [ ] Every unit is picture + number + line; no paragraphs on marketing screens.
- [ ] One H1 (≤ 8 words); one filled button per view; button labels without arrows.
- [ ] Touching sections never share a surface.
- [ ] Nothing from §2: no eyebrows, chips, arrows, big radii, gradients, hamburger, AI faces; sliding rows only as §8 describes.
- [ ] Only Hanken Grotesk 400/600, only the 8 type roles in §6, only the colours in §5, radius 3px.
- [ ] Images carry information; people are real or marked stock placeholders.
- [ ] Checked at 1440, 820 and 390 wide: no sideways overflow, no orphan card, 44px targets, H1 + facts + Join in the phone's first screen.
- [ ] Focus ring visible, reduced motion respected, contrast at least 4.5:1.
- [ ] Placeholders marked in code and listed in §17.
- [ ] Side by side with `plan/mockups/home-v11.html`, it looks like the same product.

---

## 19. Version history

| Guide version | Date | Reference mockup | What it was | Status |
|---|---|---|---|---|
| 9 | 2026-11-25 | [`mockups/homepage-v9.html`](mockups/homepage-v9.html) | Teal + yellow, Schibsted Grotesk 800, inset rounded panels, slanted hero frame, month climb, marquee placements | **Superseded.** Owner: "looks AI made, a bit childish". Guide archived at `archive/15-design-and-ux-guide-v9.md`. Still what the app renders |
| — | 2026-11-26 | [`mockups/hero-redesign.html`](mockups/hero-redesign.html) | Four hero directions from scratch: A Editorial, B Photo-led, C Syllabus-led, D Proof-led | Exploration. **B Photo-led picked** |
| — | 2026-11-26 | [`mockups/home-photo-led.html`](mockups/home-photo-led.html) | Full photo-led page with options: 4 heroes, climb/rows, wall/featured, ink/teal | Exploration. Picked **Split hero, Rows, Wall, Ink + saffron** |
| 10 | 2026-11-26 | [`mockups/home-v10.html`](mockups/home-v10.html) | Research-backed refinement: clarity-first hero, strict type scale, AI tropes removed, container-query layout, visible phone nav, sticky phone bar | **Superseded.** Owner loved only the placement wall; the rest was "too text heavy" |
| **11** | **2026-11-26** | [`mockups/home-v11.html`](mockups/home-v11.html) | Every section rebuilt as picture + number + line units, modelled on the placement wall; real learner in the hero; month cards with code diagrams; number tiles; batch ticket | Current for wide screens and tablet |
| **11.1** | **2026-11-26** | No new mockup; the app (`phone.css`) | Phone redesign after owner feedback: hiding navbar, sliding rows, photo-first hero, money row, "Start with" fee wording | **Current** |

**How to version from now on:** a new mockup gets the next number (`home-v12.html`). When the owner approves it, update this guide, bump its version in the header, add a row here and to §20, and archive the previous guide under `plan/archive/`.

---

## 20. Decision log (do not reopen these)

Rows marked *superseded* are kept for history.

| Date | Decision | Why |
|---|---|---|
| 2026-11-23 | No AI-slop tropes; real photos; hierarchy before styling | The owner rejected a gradient, aurora-style hero and a plain table-heavy one |
| 2026-11-24 | *Superseded 2026-11-26:* teal + yellow, Schibsted Grotesk, slanted hero panel | Replaced by ink + saffron, Hanken Grotesk, straight edges |
| 2026-11-25 | *Superseded 2026-11-26:* inset panels on a white page | Replaced by full-width bands |
| 2026-11-25 | "What you get with every course" removed for good; specific content instead | The owner's most disliked section |
| 2026-11-25 | Visual over text; images must carry information | Text-heavy sections cause overload; decorative images are ignored |
| 2026-11-25 | No prices on catalog cards; the price lives on the program page and the batch ticket | Owner request |
| 2026-11-25 | The site sells only CEAP | Owner direction |
| 2026-11-25 | Diagrams in code, not generated images | Exact claims, consistent style, readable labels |
| 2026-11-25 | Counsellor card kept minimal (no example chat, no chips) | "Too much happening, keep it simple and to the point" |
| 2026-11-25 | *Superseded 2026-11-26:* the month climb as tabs; the two-lane placement marquee | Replaced by month cards and the static placement wall |
| 2026-11-26 | Redesign from scratch; **Photo-led** direction | Owner: v9 "looks such AI made, a bit childish, not like a real designer built it" |
| 2026-11-26 | **Split hero, Ink + saffron** palette, Hanken Grotesk 400/600, 3px radius | Picked from `home-photo-led.html` |
| 2026-11-26 | Clarity-first H1; visible link row instead of a hamburger; grids instead of swipe rows; sticky phone bar after the hero button | Research: NN/g homepage, navigation and carousel studies; sticky CTA guidance |
| 2026-11-26 | **Picture + number + line** for every marketing unit; the placement wall is the model | Owner loved only the placement wall in v10; the rest was "too text heavy" |
| 2026-11-26 | A real learner (with consent) is the hero photo; "Who joins" persona section dropped | Real faces are studied, stock personas are skipped |
| 2026-11-26 | The price is shown on the home page in the batch ticket | When and how much are the two questions every visitor has |
| 2026-11-26 | *Supersedes "grids instead of swipe rows" for phones:* sliding rows on phones (placements and number tiles slide by themselves, months are swiped) | Owner: "in phone sliding (marquee) sections look better instead of squeezing it all in" |
| 2026-11-26 | The navbar hides on scroll down on phones and returns on scroll up | Owner request |
| 2026-11-26 | ₹80,000 is always worded as the first instalment, what you start with, never as the whole fee | Owner request |

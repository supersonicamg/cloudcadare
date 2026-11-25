# 15 · Design and UX guide (CloudCadre, `aurora` theme)

> **Who this is for:** any AI agent or developer building a CloudCadre screen.
> Read it fully before any UI work. It is the single source of truth for how CloudCadre looks, reads and behaves.
> Where an older mockup (`plan/mockups/aurora-*.html`) disagrees with this guide on **visuals**, this guide wins.
> Those older mockups are still the reference for **structure** (which screens exist, what is on them, which states they need).

**Reference build:** [`plan/mockups/homepage-v9.html`](mockups/homepage-v9.html). Open it in a browser.
Its toolbar has **Phone width** (real phone layout via container queries) and **Design notes** (the reasoning per section).
When a rule here is unclear, copy what v9 does.

---

## 0. Ten rules that override everything else

1. **Hierarchy first, styling second.** For every section, write down its job, its reading order and its one main action before choosing colours.
2. **One filled button per view.** Everything else is an outline button or a text link.
3. **Show, don't tell.** Prefer a photo, logo, icon fact or diagram over a sentence. Aim for one line of text per item.
4. **Images must carry information.** A picture of *what you build*, a real face, a real certificate: yes. Decoration: never. People ignore decorative images (NN/g eye-tracking).
5. **Every section is its own region.** Two sections that touch must never share a background (see §3).
6. **Human-made, not AI-made.** Nothing from the banned list in §2, ever.
7. **Specific beats generic.** Week numbers, lab counts, names, dates and outcomes. No claims every academy makes.
8. **Two jobs on every marketing page:** (a) go deeper into the program or join it, (b) WhatsApp a real person. Do not push marketing beyond that.
9. **Honest.** Never promise a job. Mark every invented number, name, quote or photo as a placeholder in code comments.
10. **Phone is a first-class layout.** Design both widths. Nothing may overflow sideways.

---

## 1. Product context agents must keep in mind

- **CloudCadre** is a cloud training academy, the first client of the EduCore platform. The site is themed by `packages/themes/aurora`.
- **For now it sells one program only:** the **CloudCadre Elite Architect Program (CEAP)**.
  - 4 months, live online.
  - Covers AWS, Azure, Google Cloud, FinOps, Terraform, Docker, Kubernetes and CI/CD.
  - Ends with a capstone, mock interviews, and CV and LinkedIn help.
- **More programs may come later.** Design list pages so they work with one item today and many later. Never show an empty catalog.
- **The brand name on every surface is "CloudCadre".** The program is "CloudCadre Elite Architect Program" or "CEAP". Do not use "CloudEdufy" anywhere.
- **Audience:** Indian learners, in three groups:
  - freshers;
  - IT professionals (support, sysadmin, developers);
  - career switchers from finance or ops.
- **Money and numbers:** ₹, LPA, UPI, instalments. Write dates like "12 Jan".

---

## 2. Banned: what makes a page look AI-made

**Never use any of these.** The owner rejected each one explicitly.

| Banned | Use instead |
|---|---|
| Gradient text, aurora or blurred colour blobs, glow, neon | Flat solid colour; one yellow highlight bar |
| Glassmorphism, frosted panels, floating overlapping cards | Solid surfaces that sit on the grid |
| Fake dashboards, terminal windows or progress rings used as decoration | A drawing of what the learner actually builds (§9) |
| Pill badges with pulsing dots, avatar stacks, "10,000+ students" bars | One quiet trust line (★ 4.8 · 1,200+ reviews · 420+ placed) |
| Monospace or letter-spaced ALL-CAPS labels | Sentence-case labels in the site font, 13–16px, weight 600–700 |
| Emoji | Line icons (§8) or nothing |
| Several filled buttons competing | One filled button per view |
| Swooshes, waves, diagonal stripes, 3D shapes | Straight edges; the slanted panel (§6.2) is the only angle |
| AI-generated photos of people | Real photos of CloudCadre people; stock as a marked placeholder |
| Grey "image goes here" boxes in mockups | A real stand-in photo, marked as placeholder |
| Generic benefit lists ("What you get with every course" with 4 icons) | Specific content: weeks, labs, the thing you build |
| Four pastel card tints competing on one screen | One neutral panel colour plus white cards |
| Saturated cobalt or blue as the brand colour | Deep teal (§4) |

**The opposite also fails.** A plain white, single-colour, table-heavy "editorial minimal" page was rejected too. Keep warmth: real people, photos, the teal + yellow pair, and confident type.

---

## 3. Page structure: the surface rhythm

Pages are a stack of sections. Each section sits on exactly one surface:

| Surface | Colour | Shape | Use |
|---|---|---|---|
| **Page** | `#FFFFFF` | Full width, no edges | Hero, "How we teach", trainers. Content with photos that needs air |
| **Stone panel** | `#F2F2EF` | **Inset**: rounded block, page edge visible around it | Collections of white cards; the closing section |
| **Mist panel** | `#E4EFEB` | Inset | **The program only** (CEAP curriculum). Never use it for anything else |
| **Dark panel** | `#0B3F3B` | Inset | **One per page at most.** The strongest proof (placements) |
| **Footer** | `#14201F` | Full width | Footer only |

**Inset panels:**
- margin `clamp(10px, 1.6vw, 24px)` on all sides;
- radius `clamp(22px, 2.6vw, 36px)`;
- the white page shows around them. That is what tells the eye "this block is one unit" (NN/g common region) without the page looking finished early (false floor).

**Rhythm rules:**
- Two touching sections never share a surface.
- Alternate page → panel → page → panel.
- If two panels must touch, use different panel colours and a gap of at least `24px`.

**Homepage order (v9), for reference:**

| # | Section | Surface |
|---|---|---|
| — | Sticky header | page |
| 1 | Hero + "Built for" photo cards | page |
| 2 | Program climb (the 4 months) | mist panel |
| 3 | How we teach (photo mosaic) | page |
| 4 | Placements | dark panel |
| 5 | Trainers | page |
| 6 | Talk to a person + FAQ + "Next batch" strip | stone panel |
| — | Footer | ink |

---

## 4. Colour

| Token (v9 name) | Hex | Platform token | Use |
|---|---|---|---|
| `--brand` | `#0F5C56` | `--color-primary` | Filled buttons, links, headline accent, icons, diagram lines |
| `--deep` | `#0A3F3B` | derived (`primary` mixed 68% with black) | Button hover, selected states, photo tag bar, final strip |
| `--accent` | `#FFC845` | `--color-accent` | **Highlight only:** the headline marker bar, one yellow element per drawing, goal flag, outcome tags, the final "Join" button. Never body text |
| `--ink` | `#14201F` | `--color-fg` | Headings, body text on white, outline-button border |
| `--grey` | `#46514F` | — | Lead and body copy |
| `--mute` | `#67716F` | — | Small print, meta |
| `--base` | `#FFFFFF` | `--color-bg` | Page |
| `--alt` | `#F2F2EF` | `--color-muted` | Stone panel, logo tiles, chips |
| mist | `#E4EFEB` | — | Program panel, icon wells |
| `--line` | `#E2E3DF` | `--color-border` | Hairlines, card outlines |
| `--dark` / `--dark-card` | `#0B3F3B` / `#11514B` | — | Dark panel and the cards on it |
| on-dark text | `rgba(255,255,255,.80)` | — | Secondary text on dark |
| WhatsApp | `#25D366` | — | The WhatsApp glyph and the floating button only |

**Rules:**
- **60/30/10.** Neutrals carry about 90% of every screen. Teal is the brand. Yellow appears in at most one or two spots per view.
- **Teal is final.** The owner chose teal over blue twice. Do not suggest blue, even though the temporary logo was blue.
- **Text contrast:** at least 4.5:1. `--mute` is the lightest text allowed on white or stone.
- **Platform defaults differ from this guide:** `packages/ui/src/tokens.ts` has accent `#F2B705`, bg `#FBFAF7` and muted `#F0EEE8`. CloudCadre's tenant branding must set accent `#FFC845`, bg `#FFFFFF` and muted `#F2F2EF`; do it through the branding tokens, not by editing the platform defaults.

---

## 5. Type

**Font:** **Schibsted Grotesk** only, weights 400–800, loaded with `next/font` (`packages/themes/aurora/src/font.ts`). Never add a second family. Never use a monospace font for labels.

| Role | Size (desktop → phone) | Weight | Line height | Letter spacing | Colour |
|---|---|---|---|---|---|
| H1 (one per page) | `clamp(40px, 4.4vw, 62px)` | 800 | 1.0 | −0.042em | ink, with a teal phrase |
| H2 (section title) | `clamp(30px, 3.1vw, 42px)` | 750 | 1.1 | −0.03em | ink |
| H3 (card or step title) | 19–21px | 700 | 1.25 | −0.02em | ink |
| Lead | `clamp(18px, 1.45vw, 20px)`, max 34em | 400 | 1.5 | 0 | grey |
| Body | 16–17px | 400 | 1.55 | 0 | grey |
| Label, meta, facts | 13–15.5px | 600–700 | 1.4 | 0 | brand, grey or mute |
| Big numerals (month steps, stats) | 26–44px | 800 | 0.9–1 | −0.045em | brand, or yellow when selected |

**Rules:**
- Use `text-wrap: balance` on H1 and H2.
- **Sentence case everywhere.** No ALL CAPS, no letter-spacing on labels.
- **The yellow marker:** one phrase per page (usually in the H1) gets `background: linear-gradient(transparent 64%, #FFC845 64% 92%, transparent 92%)`. Keep it on one line (`white-space: nowrap`).
- **The headline pattern:** one ink line, then a teal phrase, then the marked phrase. Example: "Become a" (ink) / "**cloud architect**" (teal) / "in 4 months." (ink, on the yellow marker).

---

## 6. Layout, spacing and shape

| Thing | Value |
|---|---|
| Content width | `max-width: 1280px`, side gutters `clamp(16px, 5vw, 72px)` |
| Section padding | `clamp(56px, 6.2vw, 92px)` top and bottom |
| Section head to content | `clamp(28px, 3.4vw, 44px)` |
| Grid gaps | 12–24px (cards 14–20px) |
| Spacing scale | Multiples of 4, mostly 8 / 12 / 16 / 24 / 32 / 48 |
| Radius | Cards 20px, inner tiles 10–16px, buttons 12px (small 10px), chips and pills 99px |
| Card shadow | `0 1px 2px rgba(20,32,31,.06)`; hover `0 8px 24px rgba(20,32,31,.10)` and `translateY(-2px)` |
| Hairlines | 1px `--line`. 2px `--ink` only as a strong top rule (FAQ list, step baseline) |

**Breakpoints (v9 uses container queries; in the app use the same values in `@media`):**
- `≤ 1100px`: 3 or 4 column grids become 2 columns.
- `≤ 820px`: phone layout. One column, menu button, full-width buttons, swipe rows.

### 6.1 Section head (every section uses it)
- H2 on the left, with an optional one-line lead under it.
- An optional text link on the right, aligned to the baseline (for example "Download the syllabus →").
- Nothing else goes in the head.

### 6.2 The slanted panel (brand shape)
- A rounded parallelogram leaning right (horizontal shift = 0.33 × height), with a yellow copy offset down and to the right.
- It appears in three places: the **logo**, the **hero photo frame** and the **CEAP drawing**.
- It is the *only* angled shape in the system. Do not invent other angles, waves or swooshes.
- Hero frame CSS: `clip-path: url(#slant)` from the shared sprite (`packages/ui/src/sprite.ts`).

---

## 7. Components

Every component below is in v9; copy the markup and CSS from there.

### 7.1 Buttons and links

| Type | Look | When |
|---|---|---|
| **Filled** (`btn-brand`) | Teal fill, white text, 54px tall (small 42px) | The one main action of the view |
| **Outline** (`btn-line`) | 2px ink ring, ink text | The second action, usually WhatsApp |
| **Yellow** (`btn-accent`) | Yellow fill, ink text | **Only** in the final dark "Next batch" strip, where it is the single filled action of that view |
| **Text link** (`tlink`) | Teal, weight 650, underline on hover, trailing "→" | "See all", "Download the syllabus", "More stories" |

Button and link labels are verbs plus objects: "Join the next batch", "Ask on WhatsApp", "Message Ananya on WhatsApp". Never "Click here" or "Submit".

### 7.2 Header (sticky)
- Logo, then nav links (Program · How we teach · Placements · Trainers · FAQ), then on the right "Log in" and an outline "WhatsApp us".
- **Stays visible while scrolling.** It gets a hairline shadow once scrolled. The link for the section on screen gets a yellow underline.
- Phone: logo and a "Menu" button that opens a dropdown panel.

### 7.3 Logo
- **Mark:** the slanted teal panel with the yellow offset and a white "C" whose tips are cut on the panel's lean. File: [`plan/mockups/assets/cloudcadre-mark.svg`](mockups/assets/cloudcadre-mark.svg).
- **Wordmark:** typed text, not an image. "Cloud" in ink and "Cadre" in teal, Schibsted Grotesk 800, 24px, letter-spacing −0.035em. On the dark footer it is all white.
- **In code:** replace the `#logo` symbol in `packages/ui/src/sprite.ts` with this mark. The aurora `Brand` component already renders the symbol plus `brand.name`.

### 7.4 CEAP tag
A small teal block reading **CEAP** in white, 800 weight, then "CloudCadre Elite Architect Program" in teal 700. Use it where the program is named as a product (for example on the program page). **Not in the home hero:** the owner removed it there (it looked AI-made), and the H1 already names the outcome.

### 7.5 Facts row
Three or four short facts, each with a teal line icon: "4 months, live online" · "Next batch: 12 Jan" · "Capstone + interview prep". 15–16px, weight 650. **Use it instead of a paragraph.**

### 7.6 Trust line
"★★★★★ **4.8** · 1,200+ reviews | **420+** learners placed": one quiet line under the hero buttons. Never a big stats bar in the hero.

### 7.7 Photo card with outcome tag ("Built for")
- 16:10 photo, radius 18px, a dark scrim at the bottom (`linear-gradient(transparent, rgba(8,24,22,.86))`).
- On the scrim, bottom left: small "If you are a" and a big label ("Fresher"). Bottom right: a yellow tag with the outcome ("→ Cloud engineer").
- Three in a row. On phones they become a swipe row (cards 80% wide, scroll-snap).

### 7.8 Program climb (stepped tabs + detail panel)
The signature component, rated 10/10 by the owner. Reuse it for any staged journey: program months, onboarding steps, the learner's own progress.

**The steps:**
- 4 steps rising onto one 2px ink baseline. Step heights 168 / 204 / 240 / 276px; on phones 62 / 76 / 90 / 104px.
- Inside each step:
  - a big numeral "01"–"04";
  - "Weeks 1–4" on the right;
  - the title;
  - tool logos at the bottom.
- A yellow goal pill ("⚑ Cloud architect") sits on top of the last step.
- **Selected step:** dark teal, yellow numeral, and a small triangle pointing down at the panel.
- **Earlier steps** (already climbed): pale fill `#F2F7F5`, muted numeral and a teal tick.
- **Accessibility:** it is an ARIA `tablist`. Steps are `role="tab"` with `aria-selected`; the panel is `role="tabpanel"`. Arrow keys, Home and End move between steps.

**The detail panel (white, radius 20), read top to bottom:**
1. A 4-segment progress bar and "Month 3 of 4 · Weeks 9–12".
2. The H3 title.
3. The outcome: "**By week 12** you can …" (outcome first, with a flag icon).
4. Topics as a two-column checklist, each with a logo or a tick.
5. On the right, **You build**: the caption first, then the diagram (§9).
6. Footer: lab count on the left; on the right "← Month N" and "Next: {title} →". **The last step ends with the filled "Join the next batch".**

**Never:**
- show all four months' detail at once;
- auto-advance;
- use carousels with dots instead of this.

### 7.9 Photo mosaic ("How we teach")
- An asymmetric grid: one tall photo, one wide photo, one small photo and one drawn certificate.
- Each tile has a yellow number badge (1–4) and a caption on the photo: a title of at most 5 words and one short line.
- On phones the tiles stack, 210px tall each.

### 7.10 Placement wall (on the dark panel)
Built for trust with new visitors: many real faces at once, not a few big cards.
1. Heading, and one line of counted numbers under it ("15 placement stories · 12 companies · ₹29 LPA highest package"). Count them from the list; never an "average" of hand-picked stories.
2. Two lanes of **white** horizontal cards drifting in opposite directions (lane 1 left, lane 2 right), full width of the panel, alternating people between lanes so no face is on screen twice at once.
3. Card: square photo on the left, shown whole (square frame, `object-fit: cover`, top-aligned); on the right the package in teal ("₹17 LPA", city after it in grey), then the name, the company in bold, and the role in grey (2 lines at most). No "Was / Now" unless the previous job is known.
4. Motion: ~6s per card, linear, seamless loop (list drawn twice, track slides 50%). It stops on hover or focus and has a visible Pause / Play button. Under `prefers-reduced-motion` nothing moves and the lanes become plain rows to swipe or scroll. The duplicate list is `aria-hidden` and `inert`.
**Only real, consented placements may go live.**

### 7.11 Trainer card
- A portrait (4:4.6, radius 20) with white logo badges for what they teach (bottom left) and a dark "9 yrs" tag (top right).
- Below: the name, a LinkedIn icon link (so buyers can check the person is real) and one short role line.

### 7.12 Counsellor card (keep it simple)
- A 56px round natural portrait, the name and the role.
- One line: "Ask about the program, batch dates or fees. She usually replies within 15 minutes."
- One filled "Message {name} on WhatsApp" button.
- One small line: "Or call +91 … · 9am to 9pm, Mon to Sat".

**Nothing else.** The owner removed the example chat and the question chips as "too much happening". On desktop the card is sticky next to the FAQ.

### 7.13 FAQ
- Native `<details>`, all closed. A 2px ink top rule, then 1px hairlines.
- Question 19px/650 on the left. On the right a round "+" that turns into a yellow "–" when open.
- 5 to 6 questions; answers of at most 2 sentences.
- Must include "Do you guarantee a job?", answered honestly (no).

### 7.14 Final strip
A dark teal rounded strip at the end of the last section: "**Next batch starts 12 Jan**" with "4 months · live online · capstone and interview prep", and a yellow "Join the next batch →" button. The page ends once, on this.

### 7.15 Floating WhatsApp button
Phones only (on desktop the header already has WhatsApp). A green pill, bottom right, shown only after the hero has scrolled out of view.

---

## 8. Icons and logos

- **Line icons:**
  - 24-unit viewBox, 1.9 stroke, round caps and joins, `currentColor`, usually teal;
  - drawn at 18–24px;
  - set used: clock, lab (terminal), calendar, check, flag, briefcase, plus the ones in `packages/ui/src/marks.tsx`.
- **Platform logos** come from the shared sprite: Devicon marks (MIT), plus WhatsApp from Simple Icons.
  - Show them in white or stone tiles, radius 10–14px.
  - Google Cloud (`lg-gcp`) is in v9 and **must be added to `packages/ui/src/sprite.ts`**.
  - The FinOps mark is a placeholder; swap in the official one before launch.
- **Use logos instead of words wherever the logo is well known** (AWS, Azure, Kubernetes). In filters, show only the logo, with the label shown on the selected item, in a tooltip, and for screen readers via `aria-label`.

---

## 9. Diagrams ("You build" and course art)

Diagrams are **built in code (SVG), never generated images.** Generated images cannot show an exact claim, never match each other in style, and garble labels.

**Style:**
- Teal lines, stroke 2 (2.4 in small art), white fills, round joins.
- **Exactly one yellow element** per drawing: the thing that matters (the App tier, the "After" bar, "Live").
- Real tool logos inside (`<use href="#lg-aws">`).
- Labels in the site font, 11.5px/650.
- Lines run in `currentColor`, so a drawing follows the brand colour.

**Content:** each drawing shows its claim literally:
- "the same app on three clouds" → three cloud boxes, each with the same Web / App / Data stack;
- "a savings plan" → a bill with the waste highlighted and Before / After bars with "−32%";
- "a pipeline" → GitHub → Terraform → Docker → Kubernetes → Live.

**Motion:**
- Dashes may flow slowly along connector lines (`stroke-dashoffset` animation, 1s loop).
- Turn it off under `prefers-reduced-motion`.

**Caption first:** "You build" plus one line above the drawing, so the reader knows what they are looking at.

---

## 10. Photography

- **Best:** real CloudCadre photos, real classes, trainers, learners, the counsellor. Plan one phone photo session. It feeds the hero, the mosaic, trainers, placements and the counsellor card.
- **Stock photos** (Unsplash) are allowed as **placeholders only**. Mark them in code (`// stock placeholder`). Pick natural, warm, real-workplace shots. No posed models, no glamour portraits, no handshakes. Prefer people who look Indian.
- **No AI-generated people, ever.** Generated images are fine only without people or hands (for example a top-down desk flat-lay for the hero).
- **Framing:** radius 18–20px, `object-fit: cover`, and a dark bottom scrim when text sits on the photo.
- **Alt text:** describe what is in the photo. Faces next to a name use `alt=""` when the name is already printed.

---

## 11. Writing (microcopy)

- **Short:** one line per item. A section lead is one sentence. Answers are at most 2 sentences.
- **Outcome first:** "By week 12 you can ship an app to Kubernetes…", not "In this module we will cover…".
- **Specific:** weeks, labs, dates, names, ₹. No "world-class", "cutting-edge", "unlock your potential", "transform your career".
- **Sentence case** for every heading, button and label.
- **Second person, plain English.** Assume readers are Indian professionals and students reading in their second language. Avoid idioms.
- **Honest:** no job guarantee, no fake urgency ("only 3 seats left!") unless it is true and maintained.
- **Placeholders:** every invented figure is marked in a code comment, and listed in §15 until real data replaces it.

---

## 12. Motion

| Motion | Spec |
|---|---|
| Section reveal | Opacity 0 → 1 and `translateY(16px)` → 0, 0.5s ease, once, when 8% of the element is in view |
| Card hover | Lift 2px and a stronger shadow, 0.15s |
| Photo hover | `scale(1.03)`, 0.5s |
| Panel swap (climb) | Fade and rise 6px, 0.3s |
| Diagram flow | Dash offset loop, 1s |

**Everything is off under `prefers-reduced-motion: reduce`.** Content must be fully visible without JavaScript; add the reveal class only from JS.

---

## 13. Accessibility (must pass)

- **Focus ring:** `outline: 3px solid #FFC845; outline-offset: 3px` on every interactive element.
- **Targets:** at least 44×44px on phones.
- **Contrast:** at least 4.5:1 for text (checked for the tokens in §4).
- **Semantics:**
  - one H1 per page, headings in order;
  - sections labelled by their H2 (`aria-labelledby`);
  - lists as `ul` or `ol`;
  - FAQ with `<details>`.
- **The climb** is a proper ARIA tablist with keyboard support (§7.8).
- **External links** (`wa.me`) use `target="_blank" rel="noopener noreferrer"`.
- **No text inside images** that is not also present as real text.

---

## 14. How to build a new screen (the process)

1. **Find the screen's structure** in the older mockups (`plan/mockups/aurora-flows*.html`, `index.html`) and `node scripts/track.mjs`.
2. **Write the brief** (in your head or a comment):
   - the screen's **one job**;
   - its **one filled action**;
   - its reading order;
   - which surfaces its sections use (§3).
3. **Pick components from §7.** Make a new component only when none fits, and match the tokens in §4–6.
4. **Replace paragraphs** with facts rows, logos, icons, checklists or a diagram (§0 rule 3).
5. **Build both widths.** Check at 390px for no sideways overflow and 44px targets.
6. **Run the checklist in §16.**

### Page recipes for the rest of the site

These are the starting points; the older mockups have the full states.

| Route | Job | Structure |
|---|---|---|
| `/courses` (catalog) | While CEAP is the only program, send people to it | Show the CEAP program (or redirect to its page). When there are 2 or more programs: program cards with a "what you build" drawing on top, logos as filters, no prices on cards |
| `/courses/[slug]` (program page) | Help someone decide to join | Hero (CEAP tag, outcome H1, facts row, **price with instalment line** and "Join the next batch") → the climb with full syllabus detail → how we teach → trainers for this program → placements → FAQ → final strip. **This is where the price lives** |
| `/checkout/[orderId]` | Pay with confidence | Focus layout (logo only, no nav). Order summary card on the right (program, batch date, price, instalment option). Payment on the left. One filled "Pay ₹…" button. WhatsApp help line under it |
| `/login`, `/signup` | Get in fast | Split layout: slanted photo panel on the left (hidden on phones), form on the right. One filled button. WhatsApp help line |
| `/learn` (learner home) | Resume where you left off | "Continue" card first (the next lesson, one filled button). Then the climb reused as **your** progress, with completed months ticked. Then upcoming live classes |
| `/learn/[slug]` (lesson) | Learn without distraction | Focus layout. Video or content first, lesson list in a side panel (a sheet on phones). "Mark complete" and Next as the actions |
| `/progress`, `/certificates`, `/verify/[code]` | Show proof | Big numerals for progress, the certificate drawn as in the mosaic, and the verify page as a plain trust page (name, program, date, valid ✓) |
| `/admin/*` | Get work done | Functional UI on the same tokens (colour, type, radius, focus). No marketing patterns, no reveal animations. Dense tables are fine here |

---

## 15. Open placeholders (replace before launch)

- **Syllabus:**
  - the month split, the topics per month, lab counts and "8–10 hours a week";
  - the batch date "12 Jan";
  - the "−32%" in the month 2 diagram;
  - a syllabus PDF for "Download the syllabus".
- **Social proof:** the review score and count, every placement (people, employers, packages, photos), the stats row.
- **People:** trainer names, bios and photos, plus LinkedIn URLs; the counsellor's name, photo, phone number, reply hours and the WhatsApp number in every `wa.me` link.
- **Images:** the hero image (prompt: a top-down architect's desk flat-lay, no people, teal and yellow props), and the stock photos in "Built for" and the mosaic.
- **Logos:** the official FinOps mark.

---

## 16. Before you hand a screen over

- [ ] One H1; each section has one job and **one filled button per view**.
- [ ] Touching sections never share a surface; at most one dark panel.
- [ ] Nothing from the banned list (§2). No emoji, caps labels, gradients or glow.
- [ ] Every image carries information; people in photos are real (or a marked stock placeholder); there are no AI faces.
- [ ] Text is short, specific and outcome-first; placeholders are marked.
- [ ] Only Schibsted Grotesk, with the type scale in §5. Colours are from §4 only.
- [ ] 390px wide: no sideways overflow, 44px targets, full-width buttons.
- [ ] Keyboard focus visible; reduced motion respected; contrast at least 4.5:1.
- [ ] Compared side by side with `plan/mockups/homepage-v9.html`: it looks like the same product.

---

## 17. Decision log (do not reopen these)

| Date | Decision | Why |
|---|---|---|
| 2026-11-23 | No AI-slop tropes; real photos; one yellow accent; hierarchy before styling | The owner rejected a gradient, aurora-style hero and a plain table-heavy one |
| 2026-11-24 | Teal `#0F5C56` + yellow `#FFC845`, Schibsted Grotesk, slanted hero panel | Picked from palette and frame variants; saturated cobalt "stuck the eye" |
| 2026-11-25 | Inset panels on a white page with stone `#F2F2EF` neutrals | The old page's sections blurred together; this was picked from variants |
| 2026-11-25 | "What you get with every course" removed for good; specific content instead | The owner's most disliked section |
| 2026-11-25 | Visual over text; images must carry information | Text-heavy sections cause overload (NN/g: decorative images are ignored) |
| 2026-11-25 | Filters show logos only (label on the active one); no prices on cards | Owner request; the price lives on the program page |
| 2026-11-25 | New logo: slanted panel "C", wordmark typed in the site font; teal stays | The blue logo is temporary; the logo follows the site, not the other way round |
| 2026-11-25 | The site sells only CEAP; "Built for" uses photo cards; the month "climb" | Owner direction; the climb was rated 10/10 |
| 2026-11-25 | "You build" diagrams in code, not generated images | Exact claims, consistent style, readable labels |
| 2026-11-25 | Counsellor card kept minimal (no example chat or chips) | "Too much happening, keep it simple and to the point" |
| 2026-11-25 | The home hero has no CEAP tag line above the H1 | Owner: "looks too AI made"; the H1 and facts row already say what the program is |
| 2026-11-25 | Placements are a two-lane auto-scrolling wall of white cards, not a few large photo cards | Owner: the first version "looks ugly"; more faces at once builds trust faster, and white cards on the dark panel are clearer than dark-on-dark |

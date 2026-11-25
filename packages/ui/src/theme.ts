import type { ComponentType, ReactNode } from 'react'

/** Everything a theme may know about the academy. Plain data: themes never touch the database. */
export interface BrandInfo {
  name: string
  tagline?: string | null
  logoUrl?: string | null
  logoDarkUrl?: string | null
  contact?: { email?: string; phone?: string; whatsapp?: string; address?: string }
  showPoweredBy: boolean
  platformName: string
  /** Current year, supplied by the app so themes never call new Date() while prerendering. */
  year: number
}

export interface NavItem {
  label: string
  href: string
}

/** Marks of the platforms the academy teaches. Themes ship the artwork; content only names it. */
export type LogoKey = 'aws' | 'azure' | 'gcp' | 'kubernetes' | 'docker' | 'terraform' | 'github' | 'python' | 'finops'

/**
 * Site-wide copy that surrounds every page (announcement bar, footer). Optional: a theme must look right
 * without it. Until CMS blocks exist (plan/05 §4) the app supplies it from `lib/aurora-content.ts`.
 */
export interface SiteContent {
  /** One line above the header. The link goes to WhatsApp, so it shows only when the academy has a number. */
  announcement?: { text: string; linkLabel: string }
  footerColumns?: Array<{ title: string; links: NavItem[] }>
  legal?: NavItem[]
  /** Photo beside the sign-in form (themes with a split sign-in layout). */
  authArt?: { image: HomeImage; tag?: string }
  /** Small print under the footer, for example trademark ownership. */
  disclaimer?: string
}

/**
 * The signed-in person, for the navbar (plan/16 §7). Themes render the account menu from this; the app decides
 * what the links are. Log out is a form POST to `logoutHref`, so it works without JavaScript.
 */
export interface ViewerInfo {
  name: string
  email?: string
  /** Two letters for the avatar while there is no photo. */
  initials: string
  /** Account links above the divider: Profile, Subscription, Payments, Password and devices (+ Admin panel for staff). */
  menu: Array<NavItem & { icon?: string }>
  /** POST target that ends this device's session. */
  logoutHref: string
  /** Set on the home page only: an outline button to the dashboard beside the account button. */
  homeButton?: NavItem
}

export interface SiteLayoutProps {
  brand: BrandInfo
  nav: NavItem[]
  /** Where the primary header action points (sign in, or the learner dashboard when signed in). `viewer` is set when signed in. */
  account: { label: string; href: string; viewer?: ViewerInfo }
  site?: SiteContent
  children: ReactNode
}

export interface AuthLayoutProps {
  brand: BrandInfo
  site?: SiteContent
  children: ReactNode
}

export interface HomeImage { src: string; alt: string }

/** Line icons the home page may name. Themes ship the artwork. */
export type HomeIcon = 'clock' | 'calendar' | 'flag' | 'briefcase' | 'lab' | 'check'
/** The "You build" drawings. Built in code by the theme; content only picks one. */
export type DiagramKey = 'clouds' | 'bill' | 'pipeline' | 'review'

/** One month of the program: a step in the climb and the panel that opens under it. */
export interface ProgramMonth {
  title: string
  /** First and last week, e.g. [1, 4]. */
  weeks: [number, number]
  /** What the step shows at the bottom: tool logos, or (for a month with no tools) icons. */
  logos?: LogoKey[]
  icons?: HomeIcon[]
  diagram: DiagramKey
  /** Completes "By week N you can …" (outcome first). */
  outcome: string
  topics: Array<{ label: string; logo?: LogoKey }>
  /** Caption above the drawing, after "You build". */
  build: string
  /** Footer of the panel, e.g. "12 hands-on labs". */
  meta: string
}

/**
 * Home page copy as one typed object (CloudCadre sells one program, CEAP; plan/15). Every section is optional
 * and is skipped when absent, so an academy never shows a section it has no verified content for
 * (placements, trainers, reviews). These sections map one to one onto the CMS block types in plan/05 §4.
 */
export interface HomeContent {
  hero: {
    /** Three parts of the headline: plain, in the brand colour, and on the accent marker. */
    headline: { lead: string; accent: string; mark: string }
    lead: string
    /** Short facts with an icon each. Used instead of a paragraph. */
    facts: Array<{ icon: HomeIcon; text: string }>
    /** The one filled button of the page. Every "Join the next batch" button points here. */
    primaryCta: NavItem
    /** One quiet line under the buttons. */
    trust?: { stars: number; score: string; reviews: string; placed: { value: string; label: string } }
    /** Photo in the slanted frame. Absent: the page draws the CEAP architecture instead. */
    image?: HomeImage
    imageTag?: { text: string; link: NavItem }
    /** Who the program is for: photo cards with the outcome as a tag. */
    builtFor?: { title: string; items: Array<{ image: HomeImage; intro: string; label: string; outcome: string }> }
  }
  /** Where the syllabus PDF can be downloaded. Every "Download the syllabus" link is hidden until this is set. */
  syllabusHref?: string
  program?: {
    title: string
    lead: string
    /** The yellow flag on the last step: where the program ends, e.g. "Cloud architect". */
    goal: string
    months: ProgramMonth[]
  }
  how?: {
    title: string
    lead: string
    /** The first tile is tall, the second wide, the rest small. Numbered 1..n, then the certificate. */
    tiles: Array<{ image: HomeImage; title: string; line: string }>
    certificate: { image: HomeImage; title: string; line: string }
  }
  placements?: {
    title: string
    link?: NavItem
    stats: Array<{ value: string; label: string }>
    items: Array<{
      name: string
      photo: string
      /** Package in lakhs per annum, e.g. "9.5". */
      lpa: string
      /** What they did before. Optional: shown as a "Was" row only when known. */
      was?: string
      now: string
      company: string
      /** The employer's logo (an image URL). Optional: the company name is shown in text when there is none. */
      logo?: string
      city?: string
    }>
  }
  trainers?: {
    title: string
    items: Array<{ name: string; role: string; years: number; photo: string; teaches: LogoKey[]; linkedin?: string }>
  }
  talk?: {
    title: string
    lead: string
    /** The person behind the WhatsApp number. The number itself comes from the academy's contact settings. */
    counsellor?: { name: string; role: string; photo: string; line: string; message: string; hours?: string }
    faq: Array<{ question: string; answer: string }>
    /** The strip that ends the page. */
    nextBatch: { title: string; meta: string }
  }
}

/** Chrome-free wrapper for focus pages (lesson player, quiz): the theme's font and colours, no site menu. */
export interface FocusLayoutProps {
  brand: BrandInfo
  children: ReactNode
  /** Optional top bar for focus pages that need one (checkout): logo, a page name, and one way out. No site menu. */
  bar?: { title: string; exit?: NavItem; note?: string }
}

export interface HomePageProps {
  brand: BrandInfo
  content?: HomeContent
}

// DTOs the app hands to themes. They mirror what @educore/core returns, but are declared here so that
// themes (which may not import core) stay pure presentation.
export interface CourseCardDto {
  id: string
  slug: string
  kind: string
  title: string
  subtitle: string | null
  summary: string | null
  level: string
  deliveryMode: string
  lessonCount: number
  estimatedMinutes: number | null
  tags: string[]
  /** Lowest one-time price, for catalog cards. Null when nothing sells the course. */
  price: { amountMinor: number; compareAtMinor: number | null; currency: string } | null
  /** Anyone signed in may enrol for free. */
  enrolmentOpen: boolean
}
/** `previewHref` is set only for free previews: a page anyone may open without signing in. */
export interface LessonDto { id: string; title: string; type: string; durationSeconds: number | null; isPreview: boolean; previewHref?: string }
export interface SectionDto {
  id: string
  label: string | null
  title: string
  description: string | null
  lessons: LessonDto[]
  children: SectionDto[]
}
export interface OfferDto {
  amountMinor: number
  compareAtMinor: number | null
  currency: string
  /** Shown under the price, for example "GST 18%" when the price already includes it. */
  taxIncluded: boolean
  taxLabel: string | null
}
export interface CourseDto extends CourseCardDto {
  offer: OfferDto | null
  outcomes: string[]
  requirements: string[]
  sections: SectionDto[]
}

export interface CatalogPageProps {
  brand: BrandInfo
  courses: CourseCardDto[]
  /** Singular/plural nouns from the academy's terminology ("Course"/"Courses", "Program"/"Programs"). */
  terms: { course: string; courses: string }
}
/**
 * The one primary action on a course page. A link (`href`), a form action (`action`, a server action
 * the app supplies), or neither: then it renders as a disabled button explaining itself through `note`.
 */
export interface CourseCta {
  label: string
  href?: string
  action?: (formData: FormData) => void | Promise<void>
  note?: string
}
export interface CoursePageProps {
  brand: BrandInfo
  site?: SiteContent
  course: CourseDto
  cta: CourseCta
  terms: { course: string; courses: string }
}

/** plan/05 §5. Pages and blocks join this contract as the modules that need them are built. */
export interface ThemeContract {
  key: string
  SiteLayout: ComponentType<SiteLayoutProps>
  AuthLayout: ComponentType<AuthLayoutProps>
  FocusLayout: ComponentType<FocusLayoutProps>
  HomePage: ComponentType<HomePageProps>
  CatalogPage: ComponentType<CatalogPageProps>
  CoursePage: ComponentType<CoursePageProps>
}

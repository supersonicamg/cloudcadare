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
  /** A shorter label for the phone link row, where four tabs share 390px. */
  shortLabel?: string
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

/** The "What you build" drawings. Built in code by the theme; content only picks one (plan/15 §11). */
export type DiagramKey = 'clouds' | 'bill' | 'pipeline' | 'review'

/** One month of the program: a card with a drawing of what you build, a label, a title and one short line (plan/15 §10.5). */
export interface ProgramMonth {
  /** 1 to 4. Shown as "Month 1". */
  n: number
  /** After the dot in the label, e.g. "12 labs" or "capstone". */
  meta: string
  /** What you build, outcome first: "One app on three clouds". */
  title: string
  /** The topics in about six words. Hidden on phones. */
  line: string
  diagram: DiagramKey
}

/** One day of the week in the batch ticket. `class` and `lab` carry a short time; a `free` day shows a dash. */
export interface BatchDay { day: string; kind: 'class' | 'lab' | 'free'; time?: string[] }

/**
 * Home page copy as one typed object (CloudCadre sells one program, CEAP; plan/15 v11). Every section is optional
 * and is skipped when absent, so an academy never shows a section it has no verified content for. These sections map
 * one to one onto the CMS block types in plan/05 §4. Every unit is a picture, one big value and one short line.
 */
export interface HomeContent {
  hero: {
    /** The H1: at most 8 words, plain, names the outcome. */
    headline: string
    lead: string
    /** Three facts that answer when, what time and how much. */
    facts: Array<{ label: string; value: string }>
    /** The one filled button of the page. Every "Join" button points here or to the batch ticket. */
    primaryCta: NavItem
    /** A real learner: the hero picture. Needs the learner's written consent. */
    learner: { photo: string; alt: string; package: string; name: string; role: string; company: string }
  }
  /** Where the syllabus PDF can be downloaded. The "Full syllabus (PDF)" link is hidden until this is set. */
  syllabusHref?: string
  placements?: {
    title: string
    /** Counted from the list: "15 learners · 12 companies · up to ₹29 LPA". `prefix` goes before the bold value. */
    stats: Array<{ prefix?: string; value: string; label?: string }>
    /** Employer logos for the section head, in grey. */
    logos: Array<{ src: string; alt: string; size?: 'tall' | 'heavy' }>
    footnote: string
    items: Array<{
      name: string
      /** Square photo, cropped on the face. */
      photo: string
      /** Package in lakhs per annum, e.g. "9.5". */
      lpa: string
      now: string
      company: string
      /** The employer's logo (an image URL). Optional: the company name is shown in text when there is none. */
      logo?: string
    }>
  }
  /** `goal` is not shown on the home page: the learner dashboard uses it for the flag on the last step of its climb. */
  program?: { title: string; goal?: string; months: ProgramMonth[] }
  how?: {
    title: string
    /** Four number tiles: photo, one big number, three or four words. */
    tiles: Array<{ image: HomeImage; value: string; line: string }>
  }
  batch?: {
    title: string
    /** "January 2027" */
    month: string
    /** "12" */
    day: string
    length: string
    week: BatchDay[]
    fee: { amount: string; per: string; alt: string }
    join: NavItem
    /** Phone action bar: "Next batch 12 Jan" over "₹15,000 a month", and the short button label. */
    bar: { title: string; line: string; label: string }
  }
  talk?: {
    faqTitle: string
    /** The person behind the WhatsApp number. The number itself comes from the academy's contact settings. */
    counsellor?: { name: string; role: string; photo: string; message: string }
    faq: Array<{ question: string; answer: string }>
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
  /** The list this course belongs to. Absent when it is the academy's only course: no breadcrumb back. */
  catalogHref?: string
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

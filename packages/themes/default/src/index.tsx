import Link from 'next/link'
import type {
  AuthLayoutProps, CatalogPageProps, FocusLayoutProps, CourseCardDto, CoursePageProps, HomePageProps, SectionDto, SiteLayoutProps, ThemeContract,
} from '@educore/ui/theme'

// The fallback theme. Every other theme falls back to this one for any page or block it does not implement.
// Type scale: 14 / 16 / 20 / 36-56. One filled button per view.

function SiteLayout({ brand, nav, account, children }: SiteLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
          <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
            {brand.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto" />
              : brand.name}
          </Link>
          <nav aria-label="Main" className="hidden gap-7 text-[15px] md:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-fg/75 hover:text-fg">{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href={account.href}
              className="rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {account.label}
            </Link>
            {account.viewer && (
              <>
                <Link href={account.viewer.menu[0]?.href ?? '/account'} className="hidden text-sm font-medium hover:underline sm:inline">Account</Link>
                {/* A plain form POST: works without JavaScript and ends this device only. */}
                <form action={account.viewer.logoutHref} method="post">
                  <button type="submit" className="rounded-[var(--radius)] px-3 py-2 text-sm font-medium hover:bg-muted">Log out</button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-fg/70">
          <span>&copy; {brand.year} {brand.name}</span>
          <span className="flex gap-5">
            {brand.contact?.email && <a href={`mailto:${brand.contact.email}`} className="hover:text-fg">{brand.contact.email}</a>}
            {brand.contact?.phone && <a href={`tel:${brand.contact.phone}`} className="hover:text-fg">{brand.contact.phone}</a>}
          </span>
          {brand.showPoweredBy && <span>Powered by {brand.platformName}</span>}
        </div>
      </footer>
    </div>
  )
}

function AuthLayout({ brand, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="mb-8 font-heading text-xl font-semibold tracking-tight">{brand.name}</Link>
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-border bg-bg p-6">{children}</div>
    </div>
  )
}

function FocusLayout({ children }: FocusLayoutProps) {
  return <div className="min-h-screen">{children}</div>
}

function HomePage({ brand }: HomePageProps) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
      <h1 className="font-heading max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
        {brand.name}
      </h1>
      {brand.tagline && <p className="mt-5 max-w-2xl text-xl text-fg/75">{brand.tagline}</p>}
      <p className="mt-12 max-w-xl text-[15px] text-fg/60">
        Courses will appear here as soon as the academy publishes them.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------- catalog & course

const LEVEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', all: 'All levels' }
const MODE: Record<string, string> = { self_paced: 'Self-paced', cohort: 'Cohort', live: 'Live', hybrid: 'Live + self-paced', offline: 'In person' }
const LESSON: Record<string, string> = {
  video: 'Video', live: 'Live class', pdf: 'PDF', document: 'Document', image: 'Image', audio: 'Audio', article: 'Reading',
  quiz: 'Quiz', test: 'Test', assignment: 'Assignment', external_link: 'Link', embed: 'Embedded', scorm: 'Module', lab: 'Lab', download: 'Download',
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function duration(minutes: number | null): string | null {
  if (!minutes) return null
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}
function lessonTime(seconds: number | null): string | null {
  return seconds ? `${Math.max(1, Math.round(seconds / 60))} min` : null
}

function Meta({ items }: { items: Array<string | null | undefined | false> }) {
  const shown = items.filter(Boolean) as string[]
  return <p className="text-sm text-fg/65">{shown.join('  ·  ')}</p>
}

function CourseRow({ c }: { c: CourseCardDto }) {
  return (
    <li>
      <Link href={`/courses/${c.slug}`} className="group block border-t border-border py-7 first:border-t-0 md:grid md:grid-cols-[1fr_16rem] md:gap-10">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight group-hover:text-primary">{c.title}</h2>
          {c.subtitle && <p className="mt-1 text-lg text-fg/75">{c.subtitle}</p>}
          {c.summary && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg/70">{c.summary}</p>}
        </div>
        <div className="mt-4 space-y-1 md:mt-1">
          <Meta items={[LEVEL[c.level], MODE[c.deliveryMode]]} />
          <Meta items={[c.lessonCount ? plural(c.lessonCount, 'lesson') : null, duration(c.estimatedMinutes)]} />
        </div>
      </Link>
    </li>
  )
}

function CatalogPage({ courses, terms }: CatalogPageProps) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-14 md:py-20">
      <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">{terms.courses}</h1>
      {courses.length === 0 ? (
        <p className="mt-8 max-w-xl text-fg/70">Nothing is published yet. Check back soon.</p>
      ) : (
        <ul className="mt-10 border-b border-border">{courses.map((c) => <CourseRow key={c.id} c={c} />)}</ul>
      )}
    </section>
  )
}

function Curriculum({ sections, depth = 0 }: { sections: SectionDto[]; depth?: number }) {
  return (
    <div className={depth ? 'ml-4 border-l border-border pl-4' : ''}>
      {sections.map((s, i) => (
        <details key={s.id} open={depth === 0 && i === 0} className="group border-b border-border py-4">
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4">
            <span className="font-medium">
              {s.label && <span className="mr-2 text-fg/60">{s.label}</span>}{s.title}
            </span>
            <span className="text-sm text-fg/60">{s.lessons.length ? plural(s.lessons.length, 'lesson') : ''}</span>
          </summary>
          {s.description && <p className="mt-2 text-[15px] text-fg/70">{s.description}</p>}
          <ul className="mt-3 space-y-2">
            {s.lessons.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-4 text-[15px]">
                <span>
                  {l.previewHref ? <Link href={l.previewHref} className="hover:text-primary hover:underline">{l.title}</Link> : l.title}
                  {l.isPreview && <span className="ml-2 text-sm font-medium text-primary">Free preview</span>}
                </span>
                <span className="whitespace-nowrap text-sm text-fg/60">{[LESSON[l.type] ?? l.type, lessonTime(l.durationSeconds)].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
          </ul>
          {s.children.length > 0 && <div className="mt-3"><Curriculum sections={s.children} depth={depth + 1} /></div>}
        </details>
      ))}
    </div>
  )
}

/** Minor units to a display price. Whole amounts have no decimals ("₹1,180"), others keep two. */
function money(minor: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100)
}

const CTA = 'mt-5 block w-full rounded-[var(--radius)] bg-primary px-4 py-3 text-center text-sm font-medium text-primary-fg'

function CoursePage({ course, cta, terms }: CoursePageProps) {
  return (
    <article className="mx-auto max-w-6xl px-5 py-14 md:py-20">
      <Link href="/courses" className="text-sm text-fg/65 hover:text-fg">&larr; All {terms.courses.toLowerCase()}</Link>
      <div className="mt-6 grid gap-12 md:grid-cols-[1fr_20rem]">
        <div>
          <h1 className="font-heading text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">{course.title}</h1>
          {course.subtitle && <p className="mt-4 text-xl text-fg/75">{course.subtitle}</p>}
          <div className="mt-5"><Meta items={[LEVEL[course.level], MODE[course.deliveryMode], course.lessonCount ? plural(course.lessonCount, 'lesson') : null, duration(course.estimatedMinutes)]} /></div>
          {course.summary && <p className="mt-8 max-w-2xl text-[17px] leading-relaxed text-fg/80">{course.summary}</p>}

          {course.outcomes.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold">What you will be able to do</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] marker:text-primary">{course.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
            </section>
          )}
          {course.sections.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-2 text-xl font-semibold">Curriculum</h2>
              <div className="border-t border-border"><Curriculum sections={course.sections} /></div>
            </section>
          )}
          {course.requirements.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold">Before you start</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px]">{course.requirements.map((o) => <li key={o}>{o}</li>)}</ul>
            </section>
          )}
        </div>
        <aside className="md:sticky md:top-8 md:self-start">
          <div className="rounded-[var(--radius)] border border-border p-6">
            {course.offer ? (
              <div>
                <p className="flex items-baseline gap-3">
                  <span className="text-3xl font-semibold tracking-tight">{money(course.offer.amountMinor, course.offer.currency)}</span>
                  {course.offer.compareAtMinor && course.offer.compareAtMinor > course.offer.amountMinor && (
                    <span className="text-fg/55 line-through">{money(course.offer.compareAtMinor, course.offer.currency)}</span>
                  )}
                </p>
                {course.offer.taxIncluded && <p className="mt-1 text-sm text-fg/65">Includes {course.offer.taxLabel ?? 'tax'}</p>}
              </div>
            ) : <p className="font-medium">{course.title}</p>}
            {cta.href ? (
              <Link href={cta.href} className={`${CTA} hover:opacity-90`}>{cta.label}</Link>
            ) : cta.action ? (
              <form action={cta.action}><button className={`${CTA} hover:opacity-90`}>{cta.label}</button></form>
            ) : (
              <button disabled className={`${CTA} opacity-60`}>{cta.label}</button>
            )}
            {cta.note && <p className="mt-3 text-sm text-fg/65">{cta.note}</p>}
          </div>
        </aside>
      </div>
    </article>
  )
}

export const defaultTheme: ThemeContract = { key: 'default', SiteLayout, AuthLayout, FocusLayout, HomePage, CatalogPage, CoursePage }
export default defaultTheme

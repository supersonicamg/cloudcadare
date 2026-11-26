import type { CoursePageProps, LessonDto, SectionDto } from '@educore/ui/theme'
import { Icon, type IconName } from '@educore/ui/marks'
import { PhoneBar } from './client'
import { A, WhatsAppIcon, waLink } from './parts'

// The program page in the home page's look (plan/15 version 11): dark hero with the facts and the fee, then white and
// paper bands. One filled button per view: the hero's, then the one beside the outline (wide screens) or in the bottom
// bar (phones). Styles in course.css.

const LEVEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', all: 'All levels' }
const MODE: Record<string, string> = { self_paced: 'Self-paced', cohort: 'Cohort', live: 'Live', hybrid: 'Live + self-paced', offline: 'In person' }
const TYPE_ICON: Record<string, IconName> = {
  video: 'video', live: 'video', lab: 'lab', quiz: 'quiz', test: 'quiz', external_link: 'link', embed: 'link',
}
/** A first module longer than this starts closed, so the page does not open as a wall of lesson names. */
const OPEN_UP_TO = 8
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

function money(minor: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100)
}
function duration(minutes: number | null) {
  if (!minutes) return null
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}
const lessonCount = (s: SectionDto): number => s.lessons.length + s.children.reduce((n, c) => n + lessonCount(c), 0)

function Lesson({ l }: { l: LessonDto }) {
  const body = (
    <>
      <Icon name={TYPE_ICON[l.type] ?? 'doc'} className="ic" />
      <span className="name">{l.title}</span>
      {l.isPreview ? <em>Free preview</em> : l.durationSeconds ? <span className="t">{Math.max(1, Math.round(l.durationSeconds / 60))} min</span> : null}
    </>
  )
  return <li>{l.previewHref ? <A href={l.previewHref}>{body}</A> : <div>{body}</div>}</li>
}

function Section({ s, n, open }: { s: SectionDto; n: number; open: boolean }) {
  const count = lessonCount(s)
  const head = <><span className="n">{n}</span><span className="name">{s.title}</span></>
  // A module with nothing listed yet is a plain row: nothing to open.
  if (!count) return <div className="empty">{head}</div>
  return (
    <details open={open}>
      <summary>{head}<span className="t-label">{plural(count, 'lesson')}</span></summary>
      {s.lessons.length > 0 && <ul>{s.lessons.map((l) => <Lesson key={l.id} l={l} />)}</ul>}
      {s.children.map((c) => (
        <div key={c.id} className="sub">
          <p>{c.title}</p>
          <ul>{c.lessons.map((l) => <Lesson key={l.id} l={l} />)}</ul>
        </div>
      ))}
    </details>
  )
}

export function CoursePage({ brand, site, course, cta, terms, catalogHref }: CoursePageProps) {
  const wa = waLink(brand, `Hi, I have a question about ${course.title}.`)
  const poster = site?.coursePosters?.[course.slug]
  const picture = poster ?? site?.authArt?.image
  const instalment = site?.courseInstalments?.includes(course.slug)
  const total = course.lessonCount
  const facts = [
    { label: 'Format', value: MODE[course.deliveryMode] },
    { label: 'Level', value: LEVEL[course.level] },
    { label: 'Lessons', value: total ? String(total) : null },
    { label: 'Length', value: duration(course.estimatedMinutes) },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value))

  const offer = course.offer
  const amount = offer ? money(offer.amountMinor, offer.currency) : null
  const tax = offer?.taxIncluded ? `Includes ${offer.taxLabel ?? 'tax'}` : null
  const price = offer && (
    <div className="price">
      <b className="t-num">{amount}</b>
      {instalment
        ? <strong>first instalment</strong>
        : offer.compareAtMinor && offer.compareAtMinor > offer.amountMinor ? <s>{money(offer.compareAtMinor, offer.currency)}</s> : null}
      {tax && <span className="t-label">{tax}</span>}
    </div>
  )
  const action = cta.href
    ? <A className="btn" href={cta.href}>{cta.label}</A>
    : cta.action
      ? <form action={cta.action}><button className="btn">{cta.label}</button></form>
      : <button type="button" className="btn" disabled>{cta.label}</button>
  const canJoin = Boolean(cta.href || cta.action)

  return (
    <article className="cc cc-course">
      <section className="chero dark" aria-labelledby="course-h">
        <div className={`wrap chero-in${picture ? '' : ' solo'}`}>
          <div>
            {catalogHref && <p className="crumb t-label"><A href={catalogHref}>{terms.courses}</A> / {course.title}</p>}
            <h1 className="t-display" id="course-h">{course.title}</h1>
            {course.subtitle && <p className="t-lead">{course.subtitle}</p>}
            {facts.length > 0 && (
              <ul className="cfacts">
                {facts.map((f) => <li key={f.label}><span className="t-label">{f.label}</span><b className="t-h3">{f.value}</b></li>)}
              </ul>
            )}
            {price}
            <div className="act" id="buy-act">
              {action}
              {wa && <a className="link" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Ask on WhatsApp</a>}
            </div>
            {cta.note && <p className="t-small note">{cta.note}</p>}
          </div>
          {picture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={poster ? 'poster' : 'photo'} src={picture.src} alt={picture.alt} width={1080} height={poster ? 1080 : 810} />
          )}
        </div>
      </section>

      {(course.summary || course.outcomes.length > 0) && (
        <section className="sec" aria-labelledby="about-h">
          <div className="wrap two">
            <h2 className="t-h2" id="about-h">{course.outcomes.length ? 'What you’ll be able to do' : 'About this course'}</h2>
            <div>
              {course.summary && <p className="t-lead">{course.summary}</p>}
              {course.outcomes.length > 0 && <ul className="rows">{course.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>}
            </div>
          </div>
        </section>
      )}

      {course.sections.length > 0 && (
        <section className="sec inside" aria-labelledby="inside-h">
          <div className="wrap two">
            <div className="side">
              <h2 className="t-h2" id="inside-h">Inside this course</h2>
              <p className="t-lead">
                {plural(course.sections.length, 'module')}{total > 0 && ` · ${plural(total, 'lesson')}`}
                {course.sections.some((s) => s.lessons.some((l) => l.isPreview)) && '. Open any lesson marked “Free preview” without an account.'}
              </p>
              {canJoin && <div className="side-buy">{price}{action}</div>}
            </div>
            <div className="modules">
              {course.sections.map((s, i) => <Section key={s.id} s={s} n={i + 1} open={i === 0 && lessonCount(s) <= OPEN_UP_TO} />)}
            </div>
          </div>
        </section>
      )}

      {course.requirements.length > 0 && (
        <section className="sec" aria-labelledby="req-h">
          <div className="wrap two">
            <h2 className="t-h2" id="req-h">Before you start</h2>
            <ul className="rows">{course.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </section>
      )}

      {canJoin && (
        <PhoneBar title={amount ?? 'Free to join'} line={instalment ? 'First instalment' : tax ?? (amount ? 'Course fee' : course.title)} trigger="buy-act" whatsapp={wa}>
          {action}
        </PhoneBar>
      )}
    </article>
  )
}

import type { CoursePageProps, LessonDto, SectionDto } from '@educore/ui/theme'
import { Icon, type IconName, platformFor } from '@educore/ui/marks'
import { A, Arrow, Logo, WhatsAppIcon, waLink } from './parts'

const LEVEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', all: 'All levels' }
const MODE: Record<string, string> = { self_paced: 'Self-paced', cohort: 'Cohort', live: 'Live', hybrid: 'Live + self-paced', offline: 'In person' }
const TYPE_ICON: Record<string, IconName> = {
  video: 'video', live: 'video', lab: 'lab', quiz: 'quiz', test: 'quiz', external_link: 'link', embed: 'link',
}
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
      <span>{l.title}</span>
      {l.isPreview ? <em>Free preview</em> : l.durationSeconds ? <span className="t">{Math.max(1, Math.round(l.durationSeconds / 60))} min</span> : null}
    </>
  )
  return l.previewHref ? <A href={l.previewHref}>{body}</A> : <div>{body}</div>
}

function Section({ s, n, open }: { s: SectionDto; n: string; open: boolean }) {
  const count = lessonCount(s)
  return (
    <details className="cdet" open={open}>
      <summary><span className="ol-n">{n}</span><span>{s.title}</span><span className="meta">{count ? plural(count, 'lesson') : ''}</span></summary>
      <div className="ol-sub">
        {s.lessons.map((l) => <Lesson key={l.id} l={l} />)}
        {s.children.map((c) => (
          <div key={c.id} style={{ display: 'block', padding: 0 }}>
            <p style={{ fontWeight: 650, color: 'var(--ink)', padding: '7px 0' }}>{c.title}</p>
            <div className="ol-sub" style={{ padding: 0 }}>{c.lessons.map((l) => <Lesson key={l.id} l={l} />)}</div>
          </div>
        ))}
      </div>
    </details>
  )
}

export function CoursePage({ brand, site, course, cta, terms, catalogHref }: CoursePageProps) {
  const wa = waLink(brand)
  const logo = platformFor(course.title, course.tags)
  const art = site?.authArt
  const poster = site?.coursePosters?.[course.slug]
  const total = course.lessonCount
  const facts = [LEVEL[course.level], MODE[course.deliveryMode], total ? plural(total, 'lesson') : null, duration(course.estimatedMinutes)].filter(Boolean) as string[]
  const action = cta.href
    ? <A className="btn btn-brand" href={cta.href}>{cta.label}<Arrow /></A>
    : cta.action
      ? <form action={cta.action}><button className="btn btn-brand">{cta.label}<Arrow /></button></form>
      : <button className="btn is-off" disabled>{cta.label}</button>
  const instalment = site?.courseInstalments?.includes(course.slug)
  const price = course.offer && (
    <div className="price">
      <b>{money(course.offer.amountMinor, course.offer.currency)}</b>
      {instalment
        ? <strong>first instalment</strong>
        : course.offer.compareAtMinor && course.offer.compareAtMinor > course.offer.amountMinor && <s>{money(course.offer.compareAtMinor, course.offer.currency)}</s>}
      {course.offer.taxIncluded && <span>Includes {course.offer.taxLabel ?? 'tax'}</span>}
    </div>
  )

  return (
    <article className="au">
      <section className="wrap crs-hero">
        <div className="copy">
          {catalogHref && <p className="crumb"><A href={catalogHref}>{terms.courses}</A> / {course.title}</p>}
          <h1 className="h1">{course.title}</h1>
          {course.subtitle && <p className="lead">{course.subtitle}</p>}
          {facts.length > 0 && <ul className="facts">{facts.map((f) => <li key={f}>{f}</li>)}</ul>}
          <div className="buy">
            {price}
            <div className="actions">
              {action}
              {wa && <a className="btn btn-line" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Ask on WhatsApp</a>}
            </div>
            {cta.note && <p className="small">{cta.note}</p>}
          </div>
        </div>
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="crs-poster" src={poster.src} alt={poster.alt} width={1080} height={1080} />
        ) : art ? (
          <div className="ha-media" style={{ justifySelf: 'end' }}>
            <div className="ha-back shape" />
            <div className="ha-photo shape">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="photo" src={art.image.src} alt={art.image.alt} />
              {art.tag && <div className="ha-tag"><span>{art.tag}</span></div>}
            </div>
          </div>
        ) : logo ? <span className="tile" style={{ width: 120, height: 120, borderRadius: 28, background: '#fff' }}><Logo name={logo} /></span> : null}
      </section>

      {(course.summary || course.outcomes.length > 0) && (
        <section className="band-white">
          <div className="wrap sec two">
            <div>
              <h2 className="h2">{course.outcomes.length ? 'What you’ll be able to do' : 'About this course'}</h2>
              {course.summary && <p className="lead" style={{ marginTop: 14 }}>{course.summary}</p>}
            </div>
            {course.outcomes.length > 0 && <ul className="outcomes">{course.outcomes.map((o) => <li key={o} className="tick">{o}</li>)}</ul>}
          </div>
        </section>
      )}

      {course.sections.length > 0 && (
        <section className="wrap sec">
          <div className="two">
            <div>
              <h2 className="h2">Inside this course</h2>
              {course.sections.some((s) => s.lessons.some((l) => l.isPreview)) && <p className="lead" style={{ marginTop: 14 }}>Open any lesson marked “Free preview” without an account.</p>}
              <div className="buy" style={{ marginTop: 36 }}>{price}<div className="actions">{action}</div></div>
            </div>
            <div className="outline">
              <div className="ol-head">
                {logo && <span className="tile"><Logo name={logo} /></span>}
                <div><b>{plural(course.sections.length, 'module')}</b>{total > 0 && <span>{plural(total, 'lesson')}{duration(course.estimatedMinutes) ? ` · ${duration(course.estimatedMinutes)}` : ''}</span>}</div>
              </div>
              {course.sections.map((s, i) => <Section key={s.id} s={s} n={String(i + 1).padStart(2, '0')} open={i === 0} />)}
            </div>
          </div>
        </section>
      )}

      {course.requirements.length > 0 && (
        <section className="band-white">
          <div className="wrap sec two">
            <h2 className="h2">Before you start</h2>
            <ul className="outcomes" style={{ gridTemplateColumns: '1fr' }}>{course.requirements.map((r) => <li key={r} className="tick">{r}</li>)}</ul>
          </div>
        </section>
      )}
    </article>
  )
}

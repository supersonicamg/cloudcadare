import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon, type IconName } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { courseAbbr, nowMs } from '@/lib/format'
import { getMaterial, groupOf, type Group, type MaterialLesson } from '@/lib/material'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../../../_components/learner-shell'
import { dripDate, minutes } from '../../_components/curriculum'

export const metadata: Metadata = { title: 'Lessons' }

/*
 * Lessons (was "Course material"). One job: open the lesson you want.
 * Reading order: course + how far along -> search -> the four months as tabs (the month you are in is open) -> that
 * month's lessons, one row each. Filtering by kind or searching shows matches from every month instead.
 * A row says three things: whether it is done (left), what it is (under the title), and one fact on the right
 * (New, % watched, the date it opens, or the notes on it). No filled button: every row is a link.
 */

const FILTERS: Array<{ key: Group | 'all'; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'video', label: 'Videos' }, { key: 'live', label: 'Class recordings' }, { key: 'pdf', label: 'PDFs' }, { key: 'image', label: 'Images' },
]
const ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'doc', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'link', lab: 'lab' }
const KIND: Record<string, string> = { video: 'Video', live: 'Class recording', pdf: 'PDF', document: 'Document', image: 'Image', article: 'Reading', quiz: 'Quiz', test: 'Test', download: 'Download', external_link: 'Link', lab: 'Lab' }

function Row({ slug, l }: { slug: string; l: MaterialLesson }) {
  const status = l.lock ? <span className="lx-st lock"><Icon name="lock" /><span className="sr-only">Locked</span></span>
    : l.done ? <span className="lx-st ok"><Icon name="check" /><span className="sr-only">Done</span></span>
    : l.pct > 0 ? <span className="lx-st half"><span className="sr-only">Started</span></span>
    : <span className="lx-st"><span className="sr-only">Not started</span></span>
  const meta = [KIND[l.type] ?? l.type, l.type === 'quiz' ? null : minutes(l.durationSeconds)].filter(Boolean).join(' · ')
  const right = l.lock
    ? <span>{l.lock.reason === 'drip' && l.lock.unlocksAt ? `Opens ${dripDate(l.lock.unlocksAt)}` : 'Finish earlier lessons first'}</span>
    : <>
        {l.noteCount > 0 && <span className="nt"><Icon name="note" className="lx-i" />{l.noteCount}<span className="sr-only"> notes</span></span>}
        {l.done ? <span>Done</span> : l.isNew ? <span className="new">New</span> : l.pct > 0 ? <span className="pc">{l.pct}%</span> : null}
        <Icon name="chev" className="go" />
      </>
  const body = (
    <>
      {status}
      <span className="min-w-0">
        <b>{l.title}</b>
        <span className="m"><span><Icon name={ICON[l.type] ?? 'doc'} className="lx-i" />{meta}</span></span>
      </span>
      <span className="r">{right}</span>
    </>
  )
  return l.lock
    ? <li data-locked className="lx-lesson">{body}</li>
    : <li><Link href={`/learn/${slug}/${l.id}`} className="lx-lesson">{body}</Link></li>
}

export default async function Lessons({ params, searchParams }: PageProps<'/[tenant]/learn/[slug]/material'>) {
  const { slug } = await params
  const sp = await searchParams
  const a = await requireMember(`/learn/${slug}/material`)
  const [shell, m] = await Promise.all([getShell(), getMaterial(a, slug, nowMs())])
  if (!m) notFound()
  const e = m.course.enrollment
  const filter = FILTERS.find((f) => f.key === sp.type)?.key ?? 'all'
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80).toLowerCase()
  const counts = (g: Group | 'all') => (g === 'all' ? m.all.length : m.all.filter((l) => groupOf(l.type) === g).length)
  const kinds = FILTERS.filter((f) => f.key === 'all' || counts(f.key) > 0)

  // Search looks at lesson titles and at the learner's own notes.
  const noteText = new Map<string, string>()
  for (const n of m.notes) if (n.body) noteText.set(n.lessonId, `${noteText.get(n.lessonId) ?? ''} ${n.body.toLowerCase()}`)
  const hit = (l: MaterialLesson) => (filter === 'all' || groupOf(l.type) === filter) && (!q || l.title.toLowerCase().includes(q) || (noteText.get(l.id) ?? '').includes(q))

  const resume = m.course.resume
  const currentIdx = Math.max(0, m.months.findIndex((mo) => mo.lessons.some((l) => l.id === resume?.id) || mo.done < mo.lessons.length))
  const picked = m.months.findIndex((mo) => mo.id === sp.month)
  const monthIdx = picked >= 0 ? picked : currentIdx
  const month = m.months[monthIdx]
  const searching = filter !== 'all' || Boolean(q)
  const shown = searching ? m.months.map((mo) => ({ mo, rows: mo.lessons.filter(hit) })).filter((x) => x.rows.length > 0) : []
  const found = shown.reduce((n, x) => n + x.rows.length, 0)
  const qs = (o: Record<string, string>) => { const p = new URLSearchParams(o); const s = p.toString(); return `/learn/${slug}/material${s ? `?${s}` : ''}` }
  const kindHref = (type: string) => qs({ ...(type !== 'all' ? { type } : {}), ...(q ? { q } : {}) })

  return (
    <LearnerShell a={a} shell={shell} active="lessons">
      <header className="lx-head">
        <div>
          <h1 className="lx-h1">Lessons</h1>
          <p className="lx-lede">{courseAbbr(e.course.title)} · {e.lessonsCompleted} of {e.lessonsTotal} lessons done</p>
        </div>
        {resume && !searching && <Link href={`/learn/${slug}/${resume.id}`} className="lx-link">Continue: {resume.title}<Icon name="chev" /></Link>}
      </header>

      <div className="grid gap-4">
        <form action={`/learn/${slug}/material`} role="search" className="lx-search">
          {filter !== 'all' && <input type="hidden" name="type" value={filter} />}
          <label>
            <span className="sr-only">Search lessons and my notes</span>
            <Icon name="search" />
            <input name="q" type="search" defaultValue={q} placeholder="Search lessons and your notes" enterKeyHint="search" />
          </label>
          <button type="submit">Search</button>
        </form>
        {kinds.length > 2 && (
          <nav aria-label="Filter by type" className="lx-chips">
            {kinds.map((f) => (
              <Link key={f.key} href={kindHref(f.key)} aria-current={filter === f.key ? 'true' : undefined}>{f.label}<em>{counts(f.key)}</em></Link>
            ))}
          </nav>
        )}
      </div>

      {m.months.length === 0 ? (
        <section className="lx-empty"><b>Lessons are on their way</b><p>They appear here as soon as they are published.</p></section>
      ) : searching ? (
        <section aria-label="Search results" className="lx-sec">
          <div className="lx-sec-h">
            <h2 className="lx-h2">{found} {found === 1 ? 'match' : 'matches'}{q ? ` for “${q}”` : ''}</h2>
            <Link href={`/learn/${slug}/material`} className="lx-link">Clear search</Link>
          </div>
          {shown.length === 0 ? <p className="lx-empty"><b>Nothing matches</b></p> : shown.map(({ mo, rows }) => (
            <div key={mo.id} className="lx-mgroup">
              <h3 className="lx-h3">Month {m.months.indexOf(mo) + 1}: {mo.title}</h3>
              <ul className="lx-list">{rows.map((l) => <Row key={l.id} slug={slug} l={l} />)}</ul>
            </div>
          ))}
        </section>
      ) : (
        <>
          <nav aria-label="Months" className="lx-mtabs" style={{ '--n': m.months.length } as React.CSSProperties}>
            {m.months.map((mo, i) => {
              const complete = mo.lessons.length > 0 && mo.done === mo.lessons.length
              return (
                <Link key={mo.id} href={qs({ month: mo.id })} aria-current={i === monthIdx ? 'page' : undefined} className={complete ? 'done' : undefined}>
                  <span className="n">{mo.label ?? String(i + 1).padStart(2, '0')}{complete && <Icon name="check" />}</span>
                  <span className="t">{mo.title}</span>
                  <span className="s">{mo.done} of {mo.lessons.length} done</span>
                  <span className="lx-bar" aria-hidden="true"><i style={{ width: `${mo.lessons.length ? (mo.done / mo.lessons.length) * 100 : 0}%` }} /></span>
                </Link>
              )
            })}
          </nav>
          <section aria-labelledby="month-h" className="lx-sec">
            <div className="lx-sec-h">
              <h2 className="lx-h2" id="month-h">Month {monthIdx + 1}: {month!.title}</h2>
              <span className="lx-meta">{month!.lessons.length} {month!.lessons.length === 1 ? 'lesson' : 'lessons'}</span>
            </div>
            {month!.lessons.length === 0
              ? <p className="lx-empty"><b>No lessons in this month yet</b></p>
              : <ul className="lx-list">{month!.lessons.map((l) => <Row key={l.id} slug={slug} l={l} />)}</ul>}
          </section>
        </>
      )}
    </LearnerShell>
  )
}

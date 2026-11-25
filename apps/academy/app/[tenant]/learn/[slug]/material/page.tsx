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

export const metadata: Metadata = { title: 'My course' }

/*
 * My course. One job: open the lesson you want.
 * Reading order: title and how far along -> find (search, and pick a kind of material) -> the months, one under the other,
 * the one you are in already open -> a lesson is one row. Nothing is hidden behind a tab: every month is on this page.
 * Picking "PDFs" (or typing in the search) shows matches from every month instead.
 * A row says three things: what it is (the tile on the left, a tick once done), its name, and one fact on the right
 * (New, how much is watched, the day it opens, how many notes). No filled button: every row is a link.
 */

const FILTERS: Array<{ key: Group | 'all'; label: string; icon: IconName }> = [
  { key: 'all', label: 'Everything', icon: 'grid' }, { key: 'video', label: 'Videos', icon: 'video' }, { key: 'live', label: 'Class recordings', icon: 'live' }, { key: 'pdf', label: 'PDFs', icon: 'doc' }, { key: 'image', label: 'Pictures', icon: 'image' },
]
const ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'book', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'link', lab: 'lab' }
const KIND: Record<string, string> = { video: 'Video', live: 'Class recording', pdf: 'PDF', document: 'Document', image: 'Picture', article: 'Reading', quiz: 'Quiz', test: 'Test', download: 'Download', external_link: 'Link', lab: 'Lab' }

function Row({ slug, l }: { slug: string; l: MaterialLesson }) {
  const meta = [KIND[l.type] ?? l.type, l.type === 'quiz' ? null : minutes(l.durationSeconds)].filter(Boolean).join(' · ')
  const tile = l.lock ? <span className="lx-tile lock"><Icon name="lock" /><span className="sr-only">Locked</span></span>
    : l.done ? <span className="lx-tile done"><Icon name="check" /><span className="sr-only">Done</span></span>
    : <span className={`lx-tile${l.pct > 0 ? ' half' : ''}`}><Icon name={ICON[l.type] ?? 'doc'} /><span className="sr-only">{l.pct > 0 ? 'Started' : 'Not started'}</span></span>
  const right = l.lock
    ? <span>{l.lock.reason === 'drip' && l.lock.unlocksAt ? `Opens ${dripDate(l.lock.unlocksAt)}` : 'Finish earlier lessons first'}</span>
    : <>
        {l.noteCount > 0 && <span className="nt"><Icon name="note" className="lx-i" />{l.noteCount}<span className="sr-only"> notes</span></span>}
        {l.done ? <span>Done</span> : l.isNew ? <span className="new">New</span> : l.pct > 0 ? <span className="pc">{l.pct}% watched</span> : null}
        <Icon name="chev" className="go" />
      </>
  const body = (
    <>
      {tile}
      <span className="min-w-0"><b>{l.title}</b><span className="m">{meta}</span></span>
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
  const openIdx = picked >= 0 ? picked : currentIdx
  const searching = filter !== 'all' || Boolean(q)
  const shown = searching ? m.months.map((mo) => ({ mo, rows: mo.lessons.filter(hit) })).filter((x) => x.rows.length > 0) : []
  const found = shown.reduce((n, x) => n + x.rows.length, 0)
  const qs = (o: Record<string, string>) => { const p = new URLSearchParams(o); const s = p.toString(); return `/learn/${slug}/material${s ? `?${s}` : ''}` }
  const kindHref = (type: string) => qs({ ...(type !== 'all' ? { type } : {}), ...(q ? { q } : {}) })
  const pct = Math.round(e.progressPct)

  return (
    <LearnerShell a={a} shell={shell} active="lessons">
      <header className="lx-head">
        <div>
          <h1 className="lx-h1">My course</h1>
          <p className="lx-lede">{courseAbbr(e.course.title)} · {e.lessonsCompleted} of {e.lessonsTotal} lessons done ({pct}%)</p>
        </div>
        {resume && !searching && <Link href={`/learn/${slug}/${resume.id}`} className="lx-link">Continue: {resume.title}<Icon name="chev" /></Link>}
      </header>

      <div className="lx-find">
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
          <nav aria-label="Show only" className="lx-kinds">
            {kinds.map((f) => (
              <Link key={f.key} href={kindHref(f.key)} aria-current={filter === f.key ? 'true' : undefined}><Icon name={f.icon} />{f.label}<em>{counts(f.key)}</em></Link>
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
            <Link href={`/learn/${slug}/material`} className="lx-link">Show everything again</Link>
          </div>
          {shown.length === 0 ? <p className="lx-empty"><b>Nothing matches</b></p> : shown.map(({ mo, rows }) => (
            <div key={mo.id} className="lx-mgroup">
              <h3 className="lx-h3">Month {m.months.indexOf(mo) + 1}: {mo.title}</h3>
              <ul className="lx-list">{rows.map((l) => <Row key={l.id} slug={slug} l={l} />)}</ul>
            </div>
          ))}
        </section>
      ) : (
        <div className="lx-months-acc">
          {m.months.map((mo, i) => {
            const complete = mo.lessons.length > 0 && mo.done === mo.lessons.length
            const locked = mo.lessons.length > 0 && mo.lessons.every((l) => l.lock)
            const opens = locked ? mo.lessons.flatMap((l) => (l.lock?.unlocksAt ? [l.lock.unlocksAt] : [])).sort()[0] : undefined
            return (
              <details key={`${mo.id}-${openIdx}`} open={i === openIdx} className={`lx-mon${complete ? ' done' : ''}${i === currentIdx ? ' now' : ''}`}>
                <summary>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0">
                    <span className="t">{mo.title}{i === currentIdx && !complete && <em>You are here</em>}</span>
                    <span className="lx-bar thin" style={{ display: 'block' }} aria-hidden="true"><i style={{ width: `${mo.lessons.length ? (mo.done / mo.lessons.length) * 100 : 0}%` }} /></span>
                  </span>
                  <span className="c">{complete ? <><Icon name="check" className="lx-i" />All done</> : locked ? <><Icon name="lock" className="lx-i" />{opens ? `Opens ${dripDate(opens)}` : 'Locked'}</> : `${mo.done} of ${mo.lessons.length} done`}</span>
                  <Icon name="chev" className="chv" />
                </summary>
                {mo.lessons.length === 0
                  ? <p className="lx-empty"><b>No lessons in this month yet</b></p>
                  : <ul className="lx-list">{mo.lessons.map((l) => <Row key={l.id} slug={slug} l={l} />)}</ul>}
              </details>
            )
          })}
        </div>
      )}
    </LearnerShell>
  )
}

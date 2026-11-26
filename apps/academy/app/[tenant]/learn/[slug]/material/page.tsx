import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/dal'
import { courseAbbr, nowMs } from '@/lib/format'
import { getMaterial, groupOf, type Group, type MaterialLesson } from '@/lib/material'
import { getShell } from '@/lib/shell'
import { Dg, Ic, diagramOfMonth, type IconName } from '../../../_components/v11'
import { LearnerShell } from '../../../_components/learner-shell'
import { KIND, KIND_ICON, dripDate, lockText, minutes } from '../../_components/curriculum'
import { KindSelect } from '../../_components/kind-select'
import '../../my-course.css'

export const metadata: Metadata = { title: 'My course' }

/*
 * My course. One job: open the lesson you want.
 * Reading order: title and how far along -> find (search, and show only one kind of material) -> the months, one under the
 * other, the one you are in already open -> a lesson is one row. Nothing is hidden behind a tab: every month is on this page.
 * Picking "PDFs" (or typing in the search) keeps the months that have a match, all open, with only the matching rows.
 * A row says three things: what it is (the tile on the left, a tick once done), its name, and one fact on the right
 * (New, how much is watched, the day it opens, how many notes). No filled button: every row is a link.
 * The filter is the URL (?type=pdf&q=tags), so it works without script and can be shared; on a phone it is a native select.
 */

const FILTERS: Array<{ key: Group | 'all'; label: string; icon: IconName }> = [
  { key: 'all', label: 'Everything', icon: 'list' }, { key: 'video', label: 'Videos', icon: 'video' }, { key: 'live', label: 'Class recordings', icon: 'live' }, { key: 'pdf', label: 'PDFs', icon: 'doc' }, { key: 'image', label: 'Pictures', icon: 'image' },
]

function Row({ slug, l }: { slug: string; l: MaterialLesson }) {
  const meta = [KIND[l.type] ?? l.type, l.type === 'quiz' ? null : minutes(l.durationSeconds)].filter(Boolean).join(' · ')
  const tile = l.lock ? <span className="ti lock"><Ic n="lock" /><span className="sr">Locked</span></span>
    : l.done ? <span className="ti done"><Ic n="check" /><span className="sr">Done</span></span>
    : <span className={`ti${l.pct > 0 ? ' half' : ''}`}><Ic n={KIND_ICON[l.type] ?? 'doc'} />{l.pct > 0 && <span className="sr">Started</span>}</span>
  const body = (
    <>
      {tile}
      <span className="tx"><b>{l.title}</b><span>{meta}</span></span>
      <span className="rt">
        {l.lock ? lockText(l.lock) : (
          <>
            {l.noteCount > 0 && <span className="nt"><Ic n="note" s />{l.noteCount}<span className="sr"> notes</span></span>}
            {l.done ? 'Done'
              : l.pct > 0 ? <b>{l.pct}% watched</b>
              : l.isNew ? <b>New</b>
              : l.recording === 'none' ? 'Recording on its way'
              : null}
            <Ic n="chev" className="go" />
          </>
        )}
      </span>
    </>
  )
  return l.lock
    ? <li data-locked><div className="row locked">{body}</div></li>
    : <li><Link href={`/learn/${slug}/${l.id}`} className="row">{body}</Link></li>
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
  const found = searching ? m.all.filter(hit).length : 0
  const qs = (o: Record<string, string>) => { const s = new URLSearchParams(o).toString(); return `/learn/${slug}/material${s ? `?${s}` : ''}` }
  const kindHref = (type: string) => qs({ ...(type !== 'all' ? { type } : {}), ...(q ? { q } : {}) })
  const pct = Math.round(e.progressPct)

  return (
    <LearnerShell a={a} shell={shell} active="lessons">
      <div className="pg">
        <div className="pg-h">
          <div>
            <h1 className="t-title">My course</h1>
            <p className="t-lead">{courseAbbr(e.course.title)} · <b>{e.lessonsCompleted} of {e.lessonsTotal}</b> lessons done ({pct}%)</p>
          </div>
          {resume && !searching && <Link href={`/learn/${slug}/${resume.id}`} className="link">Continue: {resume.title}</Link>}
        </div>

        <div className="find">
          <form action={`/learn/${slug}/material`} role="search" className="search">
            {filter !== 'all' && <input type="hidden" name="type" value={filter} />}
            <label>
              <span className="sr">Search lessons and your notes</span>
              <Ic n="search" />
              <input name="q" type="search" defaultValue={q} placeholder="Search lessons and your notes" enterKeyHint="search" />
            </label>
            <button className="btn btn-line btn-sm" type="submit">Search</button>
          </form>
          {kinds.length > 2 && (
            <>
              <nav aria-label="Show only" className="tabs swap">
                {kinds.map((f) => (
                  <Link key={f.key} href={kindHref(f.key)} aria-current={filter === f.key ? 'true' : undefined}><Ic n={f.icon} />{f.label} <em>{counts(f.key)}</em></Link>
                ))}
              </nav>
              <KindSelect id="kind-m" action={`/learn/${slug}/material`} name="type" value={filter} label="Show only" hidden={q ? { q } : undefined}
                options={kinds.map((f) => ({ value: f.key, label: `${f.label} (${counts(f.key)})` }))} />
            </>
          )}
        </div>

        {m.months.length === 0 ? (
          <section className="empty-b"><h2 className="t-card">Lessons are on their way</h2><p className="t-body">They appear here as soon as they are published.</p></section>
        ) : searching && found === 0 ? (
          <section className="empty-b" aria-live="polite">
            <h2 className="t-card">Nothing matches{q ? ` “${q}”` : ''}</h2>
            <Link href={`/learn/${slug}/material`} className="link link-s">Show everything again</Link>
          </section>
        ) : (
          <>
            {searching && (
              <div className="blk-h" role="status">
                <h2 className="t-card">{found} {found === 1 ? 'match' : 'matches'}{q ? ` for “${q}”` : ''}</h2>
                <Link href={`/learn/${slug}/material`} className="link link-s">Show everything again</Link>
              </div>
            )}
            <div className="mlist">
              {m.months.map((mo, i) => {
                const rows = searching ? mo.lessons.filter(hit) : mo.lessons
                if (searching && rows.length === 0) return null
                const complete = mo.lessons.length > 0 && mo.done === mo.lessons.length
                const locked = mo.lessons.length > 0 && mo.lessons.every((l) => l.lock)
                const opens = locked ? mo.lessons.flatMap((l) => (l.lock?.unlocksAt ? [l.lock.unlocksAt] : [])).sort()[0] : undefined
                const now = i === currentIdx
                return (
                  <details key={`${mo.id}-${searching ? 's' : openIdx}`} open={searching || i === openIdx} className={`mon${complete ? ' done' : ''}${locked ? ' locked' : ''}${now ? ' now' : ''}`}>
                    <summary>
                      <Dg id={diagramOfMonth(i + 1)} label={false} />
                      <span className="tt">
                        <span className="t-label"><b>{mo.label ?? `Month ${i + 1}`}</b></span>
                        <span className="t-card">{mo.title}{now && !complete && <span className="here">You are here</span>}</span>
                        <span className="bar" aria-hidden="true"><i style={{ width: `${mo.lessons.length ? (mo.done / mo.lessons.length) * 100 : 0}%` }} /></span>
                      </span>
                      <span className="c">
                        {complete ? <><Ic n="check" s />All {mo.lessons.length} done</>
                          : locked ? <><Ic n="lock" s />{opens ? `Opens ${dripDate(opens)}` : 'Locked'}</>
                          : `${mo.done} of ${mo.lessons.length} done`}
                      </span>
                      <Ic n="chev" className="chv" />
                    </summary>
                    {mo.lessons.length === 0
                      ? <p className="t-label mon-none">No lessons in this month yet</p>
                      : <ul className="rows">{rows.map((l) => <Row key={l.id} slug={slug} l={l} />)}</ul>}
                  </details>
                )
              })}
            </div>
          </>
        )}
      </div>
    </LearnerShell>
  )
}

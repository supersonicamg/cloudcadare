import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon, type IconName } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { courseAbbr, nowMs } from '@/lib/format'
import { getMaterial, groupOf, type Group, type MaterialLesson } from '@/lib/material'
import { getShell } from '@/lib/shell'
import { inputSm, buttonOutline } from '@/lib/ui'
import { Panel, StatusChip } from '../../../_components/parts'
import { dripDate, minutes, ProgressBar } from '../../_components/curriculum'

export const metadata: Metadata = { title: 'Course material' }

/*
 * B2 · Course material.
 * 1. One job: find anything in the program. No filled button: every row is a link.
 * 2. Reading order: title + how far along -> filters by kind (with counts for the WHOLE program) and search -> months.
 *    The month the learner is in is open, finished months are folded; a search or filter opens every month that matches.
 * 3. Rows say one thing each: done, new, started with %, locked with its date, or how many notes are on it.
 */

const FILTERS: Array<{ key: Group | 'all'; label: string; icon: IconName }> = [
  { key: 'all', label: 'All', icon: 'grid' }, { key: 'video', label: 'Videos', icon: 'video' }, { key: 'live', label: 'Live recordings', icon: 'live' },
  { key: 'pdf', label: 'PDFs', icon: 'doc' }, { key: 'image', label: 'Images', icon: 'image' },
]
const ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'doc', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'link', lab: 'lab' }
const KIND: Record<string, string> = { video: 'Video', live: 'Live recording', pdf: 'PDF', document: 'Document', image: 'Image', article: 'Reading', quiz: 'Quiz', test: 'Test', download: 'Download', external_link: 'Link', lab: 'Lab' }

function Row({ slug, l }: { slug: string; l: MaterialLesson }) {
  const meta = [KIND[l.type] ?? l.type, l.type === 'quiz' ? null : minutes(l.durationSeconds)].filter(Boolean).join(' · ')
  const state = l.lock
    ? <StatusChip tone="locked">{l.lock.reason === 'drip' && l.lock.unlocksAt ? `Opens ${dripDate(l.lock.unlocksAt)}` : 'Locked'}</StatusChip>
    : l.done ? <StatusChip tone="ok">Done</StatusChip>
    : l.isNew ? <StatusChip tone="new">New</StatusChip>
    : l.pct > 0 ? <span className="t-label tnum whitespace-nowrap">{l.pct}%</span>
    : null
  const body = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E4EFEB] text-deep"><Icon name={ICON[l.type] ?? 'doc'} className="h-5 w-5" /></span>
      <span className="grid min-w-0"><b className="truncate font-bold text-fg">{l.title}</b><span className="t-small">{meta}</span></span>
      <span className="flex items-center justify-end gap-3">
        {l.noteCount > 0 && <span className="t-small flex items-center gap-1 whitespace-nowrap"><Icon name="note" className="h-4 w-4" /><span className="tnum">{l.noteCount}</span><span className="sr-only"> notes</span></span>}
        {state}
      </span>
    </>
  )
  const cls = 'grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-border px-1 py-3 last:border-b-0'
  return l.lock
    ? <li data-locked className={`${cls} opacity-80`}>{body}</li>
    : <li><Link href={`/learn/${slug}/${l.id}`} className={`${cls} rounded-xl hover:bg-muted/60`}>{body}</Link></li>
}

export default async function Material({ params, searchParams }: PageProps<'/[tenant]/learn/[slug]/material'>) {
  const { slug } = await params
  const sp = await searchParams
  const a = await requireMember(`/learn/${slug}/material`)
  const [{ theme, brand, nav, account, site }, m] = await Promise.all([getShell(), getMaterial(a, slug, nowMs())])
  if (!m) notFound()
  const e = m.course.enrollment
  const filter = FILTERS.find((f) => f.key === sp.type)?.key ?? 'all'
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80).toLowerCase()
  const counts = (g: Group | 'all') => (g === 'all' ? m.all.length : m.all.filter((l) => groupOf(l.type) === g).length)

  // Search looks at lesson titles and at the learner's own notes.
  const noteText = new Map<string, string>()
  for (const n of m.notes) if (n.body) noteText.set(n.lessonId, `${noteText.get(n.lessonId) ?? ''} ${n.body.toLowerCase()}`)
  const hit = (l: MaterialLesson) => (filter === 'all' || groupOf(l.type) === filter) && (!q || l.title.toLowerCase().includes(q) || (noteText.get(l.id) ?? '').includes(q))
  const currentMonth = m.months.find((mo) => mo.lessons.some((l) => l.id === m.course.resume?.id)) ?? m.months.find((mo) => mo.done < mo.lessons.length) ?? m.months[0]
  const filtering = filter !== 'all' || Boolean(q)
  const shown = m.months.map((mo) => ({ mo, rows: mo.lessons.filter(hit) })).filter((x) => x.rows.length > 0)
  const href = (type: string) => `/learn/${slug}/material${type === 'all' && !q ? '' : `?${new URLSearchParams({ ...(type !== 'all' ? { type } : {}), ...(q ? { q } : {}) })}`}`

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <main>
        <section aria-labelledby="mat-h" className="mx-auto grid max-w-[1280px] gap-6 px-[clamp(16px,5vw,72px)] pb-6 pt-8 md:pt-12">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
            <div className="grid gap-3">
              <p className="inline-flex w-fit items-center gap-2.5 t-label !text-deep"><b className="rounded-md bg-primary px-2 py-0.5 !text-white">{courseAbbr(e.course.title)}</b>{e.course.title}</p>
              <h1 id="mat-h" className="t-title">Course material</h1>
              <p className="t-lead">Every video, recording, PDF and diagram, month by month.</p>
            </div>
            <div className="grid min-w-[min(100%,260px)] gap-2">
              <p className="flex justify-between t-label !text-fg"><span className="tnum">{e.lessonsCompleted} of {e.lessonsTotal} done</span><span className="tnum !text-primary">{Math.round(e.progressPct)}%</span></p>
              <ProgressBar pct={e.progressPct} label={`${e.course.title} progress`} className="!h-2" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav aria-label="Filter by type" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Link key={f.key} href={href(f.key)} aria-current={filter === f.key ? 'true' : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 t-label ${filter === f.key ? 'border-fg bg-fg !text-white' : 'border-border hover:border-fg'}`}>
                  <Icon name={f.icon} className="h-4 w-4" />{f.label}<span className="tnum opacity-80">{counts(f.key)}</span>
                </Link>
              ))}
            </nav>
            <form action={`/learn/${slug}/material`} role="search" className="flex items-center gap-2">
              {filter !== 'all' && <input type="hidden" name="type" value={filter} />}
              <label htmlFor="mq" className="sr-only">Search lessons and my notes</label>
              <input id="mq" name="q" type="search" defaultValue={q} placeholder="Search lessons and my notes" className={`${inputSm} w-[min(100%,300px)]`} />
              <button className={buttonOutline}><Icon name="search" className="h-4 w-4" />Search</button>
            </form>
          </div>
        </section>

        <section aria-label="Months" className="px-[clamp(10px,1.6vw,24px)] pb-16">
          <Panel className="mx-auto max-w-[1280px]">
            {m.months.length === 0 ? (
              <p className="t-body">Lessons will appear here once they are published.</p>
            ) : shown.length === 0 ? (
              <p className="t-body">Nothing matches. <Link href={`/learn/${slug}/material`} className="font-semibold text-primary underline underline-offset-4">Clear the search</Link>.</p>
            ) : (
              <div className="grid gap-3">
                {shown.map(({ mo, rows }) => {
                  const complete = mo.lessons.length > 0 && mo.done === mo.lessons.length
                  return (
                    <details key={mo.id} open={filtering || mo.id === currentMonth?.id || !complete} className="group rounded-[20px] bg-white">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 px-5 py-3.5">
                        <span className="t-num !text-[28px] !text-primary">{mo.label ?? String(m.months.indexOf(mo) + 1).padStart(2, '0')}</span>
                        <span className="grid min-w-0 flex-1"><b className="t-card truncate">{mo.title}</b><span className="t-small tnum">{complete ? 'Done · ' : ''}{mo.done} of {mo.lessons.length} lessons{filtering ? ` · ${rows.length} shown` : ''}</span></span>
                        <span aria-hidden="true" className="text-2xl leading-none text-primary group-open:rotate-45">+</span>
                      </summary>
                      <ul className="border-t border-border px-4 pb-2">{rows.map((l) => <Row key={l.id} slug={slug} l={l} />)}</ul>
                    </details>
                  )
                })}
              </div>
            )}
          </Panel>
        </section>
      </main>
    </theme.SiteLayout>
  )
}

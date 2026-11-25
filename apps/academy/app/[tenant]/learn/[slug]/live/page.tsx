import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { courseAbbr, dateShort, nowMs, timeShort } from '@/lib/format'
import { getMaterial } from '@/lib/material'
import { getShell } from '@/lib/shell'
import { buttonLg, buttonOutline } from '@/lib/ui'
import { Panel, StatusChip } from '../../../_components/parts'
import { minutes, ProgressBar } from '../../_components/curriculum'

export const metadata: Metadata = { title: 'Live classes' }

/*
 * B3 · Live classes and recordings.
 * 1. One job: the next class, or a recording to watch again. One filled button: "Join class", and only while the class is open.
 * 2. Reading order: the next class (date block, time, join) -> the ones after it -> recordings, newest first, by month.
 * 3. The join link is never printed on the page: "Join class" goes through /api/live/[id]/join, which opens 10 minutes
 *    before the start, closes at the end and records attendance once.
 */

const OPEN_BEFORE_MS = 10 * 60_000
const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
const dayNum = new Intl.DateTimeFormat('en-IN', { day: '2-digit', timeZone: 'Asia/Kolkata' })
const monthShort = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })
const span = (s: string, e: string) => `${timeShort(s)} to ${timeShort(e)}`
const gcal = (title: string, s: string, e: string) => {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${f(s)}/${f(e)}`
}

export default async function Live({ params, searchParams }: PageProps<'/[tenant]/learn/[slug]/live'>) {
  const { slug } = await params
  const sp = await searchParams
  const a = await requireMember(`/learn/${slug}/live`)
  const now = nowMs()
  const [{ theme, brand, nav, account, site }, m] = await Promise.all([getShell(), getMaterial(a, slug, now)])
  if (!m) notFound()
  const e = m.course.enrollment
  const sessions = await a.db.from('live_sessions')
    .select('id, title, starts_at, ends_at, status, lesson_id')
    .or(`course_id.eq.${e.course.id},course_id.is.null`).neq('status', 'cancelled').order('starts_at', { ascending: true }).limit(200)
  const rows = sessions.data ?? []

  const upcoming = rows.filter((s) => s.status !== 'completed' && new Date(s.ends_at).getTime() > now)
  const [next, ...after] = upcoming
  const startOf = new Map(rows.filter((s) => s.lesson_id).map((s) => [s.lesson_id!, s.starts_at]))
  const recordings = m.all.filter((l) => l.type === 'live' && !l.lock).map((l) => ({ l, at: startOf.get(l.id) ?? l.publishedAt })).sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''))
  // A finished class with no recording yet (the promise is "up the same night").
  const waiting = rows.filter((s) => s.status === 'completed' && !s.lesson_id && now - new Date(s.ends_at).getTime() < 7 * 86_400_000)
  const monthId = typeof sp.month === 'string' ? sp.month : ''
  const months = m.months.filter((mo) => mo.lessons.some((l) => l.type === 'live'))
  const shown = monthId ? recordings.filter(({ l }) => l.monthId === monthId) : recordings
  const openNow = next ? now >= new Date(next.starts_at).getTime() - OPEN_BEFORE_MS && now <= new Date(next.ends_at).getTime() : false

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <main>
        <section aria-labelledby="lv-h" className="mx-auto grid max-w-[1280px] gap-8 px-[clamp(16px,5vw,72px)] pb-14 pt-8 md:pt-12">
          <div className="grid gap-3">
            <p className="inline-flex w-fit items-center gap-2.5 t-label !text-deep"><b className="rounded-md bg-primary px-2 py-0.5 !text-white">{courseAbbr(e.course.title)}</b>{e.course.title}</p>
            <h1 id="lv-h" className="t-title">Live classes</h1>
            <p className="t-lead">Every class is recorded. Watch it again here and take notes at the exact minute.</p>
          </div>

          {next ? (
            <div className="grid items-center gap-x-8 gap-y-5 rounded-[24px] border-2 border-fg p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-7">
              <div className="grid h-[88px] w-[88px] place-content-center rounded-2xl bg-fg text-center text-white">
                <b className="t-num !text-[38px] !text-accent">{dayNum.format(new Date(next.starts_at))}</b>
                <span className="t-small !text-white/85">{day.format(new Date(next.starts_at))} · {monthShort.format(new Date(next.starts_at))}</span>
              </div>
              <div className="grid min-w-0 gap-2">
                <span><StatusChip tone={openNow ? 'ok' : 'wait'}>{openNow ? 'Open now' : 'Next live class'}</StatusChip></span>
                <h2 className="t-section">{next.title}</h2>
                <p className="t-label flex items-center gap-2 !text-grey"><Icon name="clock" className="h-4 w-4" /><span className="tnum">{span(next.starts_at, next.ends_at)}</span></p>
              </div>
              <div className="grid justify-items-start gap-2 sm:justify-items-end">
                {openNow
                  ? <a href={`/api/live/${next.id}/join`} target="_blank" rel="noopener noreferrer" className={buttonLg}>Join class <span aria-hidden="true">→</span></a>
                  : <span className="t-small tnum">Join link opens at {timeShort(new Date(new Date(next.starts_at).getTime() - OPEN_BEFORE_MS))}</span>}
                <a href={gcal(next.title, next.starts_at, next.ends_at)} target="_blank" rel="noopener noreferrer" className={buttonOutline}><Icon name="calendar" className="h-4 w-4" />Add to calendar</a>
              </div>
            </div>
          ) : (
            <p className="t-body rounded-2xl bg-muted p-5 !text-fg">No live class is scheduled right now. New classes appear here as soon as they are set up.</p>
          )}

          {after.length > 0 && (
            <div className="grid gap-3">
              <h2 className="t-card">After that</h2>
              <ol className="border-t-2 border-fg">
                {after.slice(0, 6).map((s) => (
                  <li key={s.id} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-3.5">
                    <span className="t-label !text-fg tnum">{day.format(new Date(s.starts_at))} {dateShort(s.starts_at)}<span className="block font-normal text-mute">{timeShort(s.starts_at)}</span></span>
                    <b className="truncate font-bold text-fg">{s.title}</b>
                    <StatusChip tone="quiet">Live</StatusChip>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section aria-labelledby="rec-h" className="px-[clamp(10px,1.6vw,24px)] pb-16">
          <Panel className="mx-auto grid max-w-[1280px] gap-6">
            <div className="grid gap-1"><h2 id="rec-h" className="t-section">Recordings</h2><p className="t-lead">Watch again, and take notes at the exact minute.</p></div>
            {months.length > 1 && (
              <nav aria-label="Filter by month" className="flex flex-wrap gap-2">
                {[{ id: '', title: 'All months' }, ...months.map((mo, i) => ({ id: mo.id, title: mo.label ? `Month ${mo.label}` : `Month ${i + 1}` }))].map((f) => (
                  <Link key={f.id} href={f.id ? `/learn/${slug}/live?month=${f.id}` : `/learn/${slug}/live`} aria-current={monthId === f.id ? 'true' : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border-2 px-4 t-label ${monthId === f.id ? 'border-fg bg-fg !text-white' : 'border-border bg-white hover:border-fg'}`}>{f.title}</Link>
                ))}
              </nav>
            )}
            {shown.length || waiting.length ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map(({ l, at }) => (
                  <li key={l.id}>
                    <Link href={`/learn/${slug}/${l.id}`} className="grid h-full content-start gap-2.5 rounded-[20px] bg-white p-4 shadow-[0_1px_2px_rgba(20,32,31,.06)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(20,32,31,.10)]">
                      <span className="flex items-center justify-between gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E4EFEB] text-deep"><Icon name="play" className="h-5 w-5" /></span>
                        {l.done ? <StatusChip tone="ok">Watched</StatusChip> : l.isNew ? <StatusChip tone="new">New</StatusChip> : null}
                      </span>
                      <b className="t-card">{l.title}</b>
                      <span className="t-small tnum">{at ? dateShort(at) : ''}{l.durationSeconds ? ` · ${minutes(l.durationSeconds)}` : ''}{l.noteCount ? ` · ${l.noteCount} ${l.noteCount === 1 ? 'note' : 'notes'}` : ''}</span>
                      {l.pct > 0 && !l.done && <ProgressBar pct={l.pct} label={`${l.title} watched`} className="!h-1.5" />}
                    </Link>
                  </li>
                ))}
                {waiting.map((s) => (
                  <li key={s.id} className="grid content-start gap-2 rounded-[20px] border-2 border-dashed border-border p-4">
                    <StatusChip tone="wait">Recording on its way</StatusChip>
                    <b className="t-card">{s.title}</b>
                    <span className="t-small tnum">{dateShort(s.starts_at)}. It is usually up the same night.</span>
                  </li>
                ))}
              </ul>
            ) : <p className="t-body">Recordings appear here after each class.</p>}
          </Panel>
        </section>
      </main>
    </theme.SiteLayout>
  )
}

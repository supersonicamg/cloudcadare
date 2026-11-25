import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/dal'
import { nowMs } from '@/lib/format'
import { getClassSessions, upcomingClasses } from '@/lib/live'
import { getMaterial } from '@/lib/material'
import { getShell } from '@/lib/shell'
import { PendingRecording, RecordingCard, ScheduledClasses, recordingsOf } from '../../../_components/live'
import '../../../_components/learner.css'

export const metadata: Metadata = { title: 'Live classes' }

/*
 * B3 · Live classes (plan/16 §6.3). Two sections, in this order:
 * 1. Scheduled classes: the next class (date, time, join) and the ones after it. "Join" is the one filled button,
 *    only while the class is open. The link is never printed: /api/live/[id]/join opens it and records attendance.
 * 2. Recorded classes, newest first, by month. A recording is an uploaded video (plays here, with notes) or a Teams
 *    link (opens in Teams through /api/recording/[lessonId]).
 */
export default async function Live({ params, searchParams }: PageProps<'/[tenant]/learn/[slug]/live'>) {
  const { slug } = await params
  const sp = await searchParams
  const a = await requireMember(`/learn/${slug}/live`)
  const now = nowMs()
  const [{ theme, brand, nav, account, site }, m] = await Promise.all([getShell(), getMaterial(a, slug, now)])
  if (!m) notFound()
  const e = m.course.enrollment
  const mine = await a.db.from('enrollments').select('batch_id, batches(name)').eq('id', e.id).maybeSingle()
  const batch = Array.isArray(mine.data?.batches) ? mine.data.batches[0] : mine.data?.batches
  const sessions = await getClassSessions(a, e.course.id, mine.data?.batch_id ?? null)
  const upcoming = upcomingClasses(sessions, now)
  const teams = upcoming.some((s) => s.teams)

  const recordings = recordingsOf(m.all, sessions, now)
  const ready = recordings.filter((r) => r.lesson.recording !== 'none').length
  // A finished class with no recording yet (the promise is "up the same night").
  const waiting = sessions.filter((s) => s.status === 'completed' && !s.lessonId && now - new Date(s.endsAt).getTime() < 7 * 86_400_000).reverse()
  const months = m.months.map((mo, i) => ({ id: mo.id, title: `Month ${i + 1}`, n: recordings.filter((r) => r.lesson.monthId === mo.id).length })).filter((mo) => mo.n > 0)
  const monthId = typeof sp.month === 'string' && months.some((mo) => mo.id === sp.month) ? sp.month : ''
  const shown = monthId ? recordings.filter((r) => r.lesson.monthId === monthId) : recordings

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <div className="ld">
        <section aria-labelledby="lv-h" className="ld-s tight">
          <div className="ld-wrap ld-hi">
            <h1 id="lv-h" className="ld-h1">Live classes</h1>
            <p className="ld-meta">{[batch?.name ?? e.course.title, teams ? 'Classes run on Microsoft Teams' : null].filter(Boolean).join(' · ')}</p>
          </div>
        </section>

        <section aria-labelledby="sc-h" className="ld-panel ld-s">
          <div className="ld-wrap">
            <div className="ld-sub big"><div><h2 id="sc-h">Scheduled classes</h2>{upcoming.length > 0 && <p>{upcoming.length} coming up</p>}</div></div>
            <ScheduledClasses sessions={upcoming} now={now} after={6} />
          </div>
        </section>

        <section id="recorded" aria-labelledby="rc-h" className="ld-s scroll-mt-20">
          <div className="ld-wrap">
            <div className="ld-sub big" style={{ marginBottom: 20 }}><div><h2 id="rc-h">Recorded classes</h2>{ready > 0 && <p>{ready} {ready === 1 ? 'recording' : 'recordings'}</p>}</div></div>
            {months.length > 1 && (
              <nav aria-label="Filter by month" className="ld-chips">
                {[{ id: '', title: 'All months', n: recordings.length }, ...months].map((f) => (
                  <Link key={f.id} href={f.id ? `/learn/${slug}/live?month=${f.id}#recorded` : `/learn/${slug}/live#recorded`} aria-current={monthId === f.id ? 'true' : undefined}>{f.title} <em>{f.n}</em></Link>
                ))}
              </nav>
            )}
            {shown.length || (!monthId && waiting.length) ? (
              <div className="ld-recs">
                {!monthId && waiting.map((s) => <PendingRecording key={s.id} session={s} />)}
                {shown.map((r) => <RecordingCard key={r.lesson.id} slug={slug} lesson={r.lesson} at={r.at} />)}
              </div>
            ) : <p className="ld-empty" style={{ boxShadow: 'inset 0 0 0 1px var(--color-border)' }}>Recordings appear here after each class.</p>}
          </div>
        </section>
      </div>
    </theme.SiteLayout>
  )
}

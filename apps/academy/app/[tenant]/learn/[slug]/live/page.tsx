import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { nowMs } from '@/lib/format'
import { getClassSessions, upcomingClasses } from '@/lib/live'
import { getMaterial } from '@/lib/material'
import { getShell } from '@/lib/shell'
import { ClassList, NextClassHero, PendingRecording, RecordingCard, recordingsOf } from '../../../_components/live'
import { LearnerShell } from '../../../_components/learner-shell'

export const metadata: Metadata = { title: 'Live classes' }

/*
 * Live classes. A student comes here for one of two reasons, so the page has two parts, one under the other (owner,
 * plan/16 §6.3): the classes that are coming, then the recordings of the ones that are over. Nothing is hidden in a tab.
 *   Coming up:  "when is my next class, and how do I get in?" The next class is one big card; "Join" is the only filled
 *               button and only while the class is open. The link is never printed: /api/live/[id]/join opens it and
 *               records attendance. Later classes are a plain list.
 *   Recordings: "I missed a class" or "I want to watch it again". Newest first, filtered by month.
 */
export default async function Live({ params, searchParams }: PageProps<'/[tenant]/learn/[slug]/live'>) {
  const { slug } = await params
  const sp = await searchParams
  const a = await requireMember(`/learn/${slug}/live`)
  const now = nowMs()
  const [shell, m] = await Promise.all([getShell(), getMaterial(a, slug, now)])
  if (!m) notFound()
  const e = m.course.enrollment
  const mine = await a.db.from('enrollments').select('batch_id, batches(name)').eq('id', e.id).maybeSingle()
  const batch = Array.isArray(mine.data?.batches) ? mine.data.batches[0] : mine.data?.batches
  const sessions = await getClassSessions(a, e.course.id, mine.data?.batch_id ?? null)
  const upcoming = upcomingClasses(sessions, now)
  const teams = upcoming.some((s) => s.teams)

  const recordings = recordingsOf(m.all, sessions, now)
  // A finished class with no recording yet (the promise is "up the same night").
  const waiting = sessions.filter((s) => s.status === 'completed' && !s.lessonId && now - new Date(s.endsAt).getTime() < 7 * 86_400_000).reverse()
  const recCount = recordings.length + waiting.length
  const months = m.months.map((mo, i) => ({ id: mo.id, title: `Month ${i + 1}`, n: recordings.filter((r) => r.lesson.monthId === mo.id).length })).filter((mo) => mo.n > 0)
  const monthId = typeof sp.month === 'string' && months.some((mo) => mo.id === sp.month) ? sp.month : ''
  const shown = monthId ? recordings.filter((r) => r.lesson.monthId === monthId) : recordings

  const [next, ...later] = upcoming
  const base = `/learn/${slug}/live`

  return (
    <LearnerShell a={a} shell={shell} active="live">
      <header className="lx-head">
        <div>
          <h1 className="lx-h1">Live classes</h1>
          <p className="lx-lede">{[batch?.name ?? e.course.title, teams ? 'Classes run on Microsoft Teams' : null].filter(Boolean).join(' · ')}</p>
        </div>
        {next && recCount > 0 && <a href="#recordings" className="lx-link"><Icon name="play" className="lx-i" />Jump to {recCount} {recCount === 1 ? 'recording' : 'recordings'}</a>}
      </header>

      <section className="lx-sec" aria-labelledby="coming-h">
        <div className="lx-sec-h">
          <h2 className="lx-h2" id="coming-h">Coming up</h2>
          {upcoming.length > 0 && <span className="lx-meta">{upcoming.length} {upcoming.length === 1 ? 'class' : 'classes'} scheduled</span>}
        </div>
        {next ? (
          <>
            <NextClassHero s={next} now={now} />
            {later.length > 0 && (
              <div className="lx-card lx-after">
                <h3 className="lx-h3">After that</h3>
                <ClassList sessions={later.slice(0, 6)} />
                {later.length > 6 && <p className="lx-meta">And {later.length - 6} more after these.</p>}
              </div>
            )}
          </>
        ) : (
          <div className="lx-empty">
            <b>No class is scheduled right now</b>
            <p>New classes appear here as soon as they are set up. Missed one? Watch it below.</p>
          </div>
        )}
      </section>

      <section id="recordings" className="lx-sec" aria-labelledby="rec-h">
        <div className="lx-sec-h">
          <h2 className="lx-h2" id="rec-h">Class recordings</h2>
          {recCount > 0 && <span className="lx-meta">Newest first</span>}
        </div>
        {months.length > 1 && (
          <nav aria-label="Show recordings from" className="lx-chips">
            {[{ id: '', title: 'All months', n: recordings.length }, ...months].map((f) => (
              <Link key={f.id} href={f.id ? `${base}?month=${f.id}#recordings` : `${base}#recordings`} aria-current={monthId === f.id ? 'true' : undefined} scroll={false}>{f.title}<em>{f.n}</em></Link>
            ))}
          </nav>
        )}
        {shown.length || (!monthId && waiting.length) ? (
          <div className="lx-recs">
            {!monthId && waiting.map((s) => <PendingRecording key={s.id} session={s} />)}
            {shown.map((r) => <RecordingCard key={r.lesson.id} slug={slug} lesson={r.lesson} at={r.at} />)}
          </div>
        ) : <p className="lx-empty"><b>No recordings yet</b><span>Each class is recorded and usually up the same night.</span></p>}
      </section>
    </LearnerShell>
  )
}

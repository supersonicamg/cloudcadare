import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/dal'
import { nowMs } from '@/lib/format'
import { getClassSessions, upcomingClasses } from '@/lib/live'
import { getMaterial } from '@/lib/material'
import { getShell } from '@/lib/shell'
import { ClassList, NextClassHero, PendingRecording, RecordingCard, recordingsOf } from '../../../_components/live'
import { LearnerShell } from '../../../_components/learner-shell'
import { RecList } from '../../../_components/rec-list'
import { Ic } from '../../../_components/v11'

export const metadata: Metadata = { title: 'Live classes' }

/*
 * Live classes. A student comes here for one of two reasons, so the page has two parts, one under the other (owner,
 * plan/16 §6.3): the classes that are coming, then the recordings of the ones that are over. Nothing is hidden in a tab.
 *   Coming up:  "when is my next class, and how do I get in?" The next class is one big ticket; "Join" is the only filled
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
  const showWaiting = !monthId ? waiting : []

  const [next, ...later] = upcoming
  const base = `/learn/${slug}/live`

  return (
    <LearnerShell a={a} shell={shell} active="live">
      <div className="pg">
        <div className="pg-h">
          <div>
            <h1 className="t-title">Live classes</h1>
            <p className="t-lead">{[batch?.name ?? e.course.title, teams ? 'classes run on Microsoft Teams' : null].filter(Boolean).join(' · ')}</p>
          </div>
          {next && recCount > 0 && <a href="#recs-live" className="link"><Ic n="down-c" />Jump to {recCount} {recCount === 1 ? 'recording' : 'recordings'}</a>}
        </div>

        <section aria-labelledby="up-h">
          <div className="blk-h">
            <h2 className="t-h3" id="up-h">Coming up</h2>
            {upcoming.length > 0 && <p className="t-small">{upcoming.length} {upcoming.length === 1 ? 'class' : 'classes'} scheduled</p>}
          </div>
          {next ? (
            <>
              <NextClassHero s={next} now={now} />
              {later.length > 0 && (
                <div className="card after">
                  <h3 className="t-card">After that</h3>
                  <ClassList sessions={later.slice(0, 6)} />
                  {later.length > 6 && <p className="t-small">And {later.length - 6} more after these.</p>}
                </div>
              )}
            </>
          ) : (
            <div className="card nada">
              <p className="t-card">No class is scheduled right now</p>
              <p className="t-small">New classes appear here as soon as they are set up. Missed one? Watch it below.</p>
            </div>
          )}
        </section>

        <section className="blk" id="recs-live" aria-labelledby="rec-h">
          <div className="blk-h">
            <h2 className="t-h3" id="rec-h">Class recordings</h2>
            {recCount > 0 && <p className="t-small">Newest first · usually up the same night</p>}
          </div>
          {months.length > 1 && (
            <nav className="tabs rec-tabs" aria-label="Show recordings from">
              {[{ id: '', title: 'All months', n: recordings.length }, ...months].map((f) => (
                <Link key={f.id} href={f.id ? `${base}?month=${f.id}#recs-live` : `${base}#recs-live`} aria-current={monthId === f.id ? 'true' : undefined} scroll={false}>{f.title} <em>{f.n}</em></Link>
              ))}
            </nav>
          )}
          {shown.length || showWaiting.length ? (
            <RecList count={shown.length + showWaiting.length}>
              {showWaiting.map((s) => <li key={s.id}><PendingRecording session={s} /></li>)}
              {shown.map((r) => <li key={r.lesson.id}><RecordingCard slug={slug} lesson={r.lesson} at={r.at} /></li>)}
            </RecList>
          ) : (
            <div className="card nada">
              <p className="t-card">No recordings yet</p>
              <p className="t-small">Each class is recorded and usually up the same night.</p>
            </div>
          )}
        </section>
      </div>
    </LearnerShell>
  )
}

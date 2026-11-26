import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { courseAbbr, dateShort } from '@/lib/format'
import { getMyEnrollments } from '@/lib/learn'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../_components/learner-shell'
import { Ic } from '../_components/v11'
import '../account/account.css'

export const metadata = { title: 'My progress' }

/*
 * My progress ("am I moving?"). No filled button. Number tiles first, then the level as the one dark block, then badges
 * you either have (ink) or can see the way to (dashed, with what it asks), then the leaderboard. Everything comes from
 * the engagement tables; badges and boards follow their own switches (engage.badges, engage.leaderboards).
 */

interface Board { key: string; name: string; period: string; entries: { rank: number; score: number; name: string | null; me: boolean }[]; me: { rank: number; score: number } | null }
const BOARDS = [['weekly_xp', 'This week'], ['all_time_xp', 'All time']] as const
const n = (v: number) => v.toLocaleString('en-IN')

export default async function Progress({ searchParams }: PageProps<'/[tenant]/progress'>) {
  const a = await requireMember('/progress')
  const shell = await getShell()
  const { bundle } = shell
  if (!isEnabled(bundle.features, 'engage.gamification')) notFound()
  const { board: wanted } = await searchParams
  const boardKey = BOARDS.find(([k]) => k === wanted)?.[0] ?? 'weekly_xp'
  const showBadges = isEnabled(bundle.features, 'engage.badges')
  const showBoards = isEnabled(bundle.features, 'engage.leaderboards')
  const showCerts = isEnabled(bundle.features, 'learning.certificates')

  const [stats, levels, badges, mine, board, enrollments] = await Promise.all([
    a.db.from('member_stats').select('xp_total, current_streak, longest_streak, badges_count, lessons_completed, tests_taken, last_active_day').eq('member_id', a.memberId).maybeSingle(),
    a.db.from('levels').select('level_no, name, min_xp').order('min_xp'),
    showBadges ? a.db.from('badges').select('id, name, description, tier').order('created_at') : Promise.resolve({ data: [] }),
    showBadges ? a.db.from('member_badges').select('badge_id, awarded_at').eq('member_id', a.memberId) : Promise.resolve({ data: [] }),
    showBoards ? a.db.rpc('get_leaderboard', { p_key: boardKey, p_limit: 10 }) : Promise.resolve({ data: null }),
    getMyEnrollments(a),
  ])
  const xp = stats.data?.xp_total ?? 0
  const lv = levels.data ?? []
  const current = [...lv].reverse().find((l) => l.min_xp <= xp) ?? null
  const next = lv.find((l) => l.min_xp > xp) ?? null
  const earned = new Map((mine.data ?? []).map((b) => [b.badge_id, b.awarded_at]))
  const lb = board.data as unknown as Board | null
  const streak = stats.data?.current_streak ?? 0
  const lead = enrollments.find((e) => e.status === 'active') ?? enrollments[0]
  const levelPct = next ? Math.round(((xp - (current?.min_xp ?? 0)) / (next.min_xp - (current?.min_xp ?? 0))) * 100) : 100
  const tier = (t: string | null) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : null)

  return (
    <LearnerShell a={a} shell={shell} active={null}>
      <div className="pg">
        <div className="pg-h">
          <div>
            <h1 className="t-title">My progress</h1>
            {lead && <p className="t-lead">{lead.course.title}</p>}
          </div>
          {showCerts && <Link className="link" href="/certificates">What you need for the certificate</Link>}
        </div>

        <ul className="ntiles">
          {lead && (
            <li className="ntile">
              <span className="t-num tnum">{Math.round(lead.progressPct)}%</span>
              <span className="t-small">of {courseAbbr(lead.course.title)} done</span>
              <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, lead.progressPct))}%` }} /></span>
            </li>
          )}
          <li className="ntile">
            <span className="t-num tnum">{stats.data?.lessons_completed ?? 0}</span>
            <span className="t-small">lessons done{lead ? `, of ${lead.lessonsTotal}` : ''}</span>
          </li>
          <li className="ntile">
            <span className="t-num tnum" data-testid="streak">{streak}</span>
            <span className="t-small">{streak === 1 ? 'day' : 'days'} in a row · best {stats.data?.longest_streak ?? 0}</span>
          </li>
          <li className="ntile">
            <span className="t-num tnum">{stats.data?.tests_taken ?? 0}</span>
            <span className="t-small">{stats.data?.tests_taken === 1 ? 'quiz' : 'quizzes'} taken</span>
          </li>
        </ul>

        <section className="level dark" aria-labelledby="lv-h">
          <div>
            <p className="t-label">Level {current?.level_no ?? 1}{lv.length > 0 ? ` of ${lv.length}` : ''}</p>
            <h2 className="t-h3" id="lv-h" data-testid="level-name">{current?.name ?? 'Getting started'}</h2>
            {next ? (
              <>
                <span className="bar" role="progressbar" aria-valuenow={levelPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to ${next.name}`}><i style={{ width: `${levelPct}%` }} /></span>
                <p className="t-label"><b>{n(next.min_xp - xp)} XP</b> to {next.name}</p>
              </>
            ) : <p className="t-label" style={{ marginTop: 12 }}>You have reached the top level.</p>}
          </div>
          <p className="xp"><span className="t-num tnum" data-testid="xp-total">{n(xp)}</span><span className="t-label">XP earned</span></p>
        </section>

        {showBadges && (badges.data?.length ?? 0) > 0 && (
          <section className="blk" aria-labelledby="bd-h">
            <div className="blk-h"><h2 className="t-h3" id="bd-h">Badges</h2><p className="t-small"><b>{earned.size}</b> of {badges.data!.length} earned</p></div>
            <ul className="badges">
              {badges.data!.map((b) => {
                const when = earned.get(b.id)
                return (
                  <li key={b.id} className={`bdg${when ? '' : ' no'}`} data-earned={when ? 'yes' : 'no'}>
                    <span className={`ti lg${when ? ' done' : ''}`}><Ic n="medal" /></span>
                    <span className="tx">
                      <b className="t-card">{b.name}</b>
                      <span className="t-label">{when ? `Earned ${dateShort(when)}` : (b.description ?? 'Keep going to earn it.')}{tier(b.tier) ? ` · ${tier(b.tier)}` : ''}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {showBoards && (
          <section className="blk" aria-labelledby="lb-h">
            <div className="blk-h"><h2 className="t-h3" id="lb-h">Leaderboard</h2><p className="t-small">XP {boardKey === 'weekly_xp' ? 'this week' : 'in total'}</p></div>
            <nav className="tabs" aria-label="Leaderboard period" style={{ marginBottom: 8 }}>
              {BOARDS.map(([k, l]) => <Link key={k} href={`/progress?board=${k}`} aria-current={k === boardKey ? 'true' : undefined}>{l}</Link>)}
            </nav>
            {lb && lb.entries.length > 0 ? (
              <>
                <ol className="lb" data-testid="leaderboard">
                  {lb.entries.map((e) => (
                    <li key={`${e.rank}-${e.name}`} className={e.me ? 'me' : undefined}>
                      <span className="rk">{e.rank}</span>
                      <span>{e.name}{e.me ? ' (you)' : ''}</span>
                      <span className="t-small"><b>{n(Number(e.score))} XP</b></span>
                    </li>
                  ))}
                </ol>
                {lb.me && !lb.entries.some((e) => e.me) && <p className="t-body" style={{ marginTop: 14 }}>You are #{lb.me.rank} with {n(Number(lb.me.score))} XP.</p>}
              </>
            ) : <p className="t-body" style={{ marginTop: 16 }}>Nobody has earned XP in this period yet. Finish a lesson to get on the board.</p>}
          </section>
        )}
      </div>
    </LearnerShell>
  )
}

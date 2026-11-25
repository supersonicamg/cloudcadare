import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../_components/learner-shell'
import { h1s, h2s } from '@/lib/ui'
import { ProgressBar } from '../learn/_components/curriculum'

export const metadata = { title: 'My progress' }

interface Board { key: string; name: string; period: string; entries: { rank: number; score: number; name: string | null; me: boolean }[]; me: { rank: number; score: number } | null }
const BOARDS = [['weekly_xp', 'This week'], ['all_time_xp', 'All time']] as const
const date = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default async function Progress({ searchParams }: PageProps<'/[tenant]/progress'>) {
  const a = await requireMember('/progress')
  const shell = await getShell()
  const { bundle } = shell
  if (!isEnabled(bundle.features, 'engage.gamification')) notFound()
  const { board: wanted } = await searchParams
  const boardKey = BOARDS.find(([k]) => k === wanted)?.[0] ?? 'weekly_xp'
  const showBadges = isEnabled(bundle.features, 'engage.badges')
  const showBoards = isEnabled(bundle.features, 'engage.leaderboards')

  const [stats, levels, badges, mine, board] = await Promise.all([
    a.db.from('member_stats').select('xp_total, current_streak, longest_streak, badges_count, lessons_completed, tests_taken, last_active_day').eq('member_id', a.memberId).maybeSingle(),
    a.db.from('levels').select('level_no, name, min_xp').order('min_xp'),
    showBadges ? a.db.from('badges').select('id, name, description, tier').order('created_at') : Promise.resolve({ data: [] }),
    showBadges ? a.db.from('member_badges').select('badge_id, awarded_at').eq('member_id', a.memberId) : Promise.resolve({ data: [] }),
    showBoards ? a.db.rpc('get_leaderboard', { p_key: boardKey, p_limit: 10 }) : Promise.resolve({ data: null }),
  ])
  const xp = stats.data?.xp_total ?? 0
  const lv = levels.data ?? []
  const current = [...lv].reverse().find((l) => l.min_xp <= xp) ?? null
  const next = lv.find((l) => l.min_xp > xp) ?? null
  const earned = new Map((mine.data ?? []).map((b) => [b.badge_id, b.awarded_at]))
  const lb = board.data as unknown as Board | null
  // a streak that was not continued yesterday or today is over, even before the next activity resets the counter
  const streak = stats.data?.current_streak ?? 0

  const TINTS = ['bg-tint-2', 'bg-tint-1', 'bg-tint-4', 'bg-tint-3']
  const levelPct = next ? Math.round(((xp - (current?.min_xp ?? 0)) / (next.min_xp - (current?.min_xp ?? 0))) * 100) : 100
  const stat = (n: number, l: string, testid?: string) => (
    <div className="flex flex-col-reverse justify-end border-t border-border px-3.5 py-[18px] max-sm:nth-[-n+2]:border-t-0 max-sm:odd:pl-0 sm:border-l sm:border-t-0 sm:px-6 sm:py-[22px] sm:first:border-l-0 sm:first:pl-0">
      <dt className="mt-1.5 text-[15px] text-mute">{l}</dt>
      <dd className="font-heading text-4xl font-extrabold leading-none tracking-[-0.045em]" data-testid={testid}>{n}</dd>
    </div>
  )

  return (
    <LearnerShell a={a} shell={shell} active={null}>
      <section>
        <h1 className={h1s}>My progress</h1>

        <div className="mt-[26px] grid items-end gap-6 rounded-[28px] bg-tint-1 p-6 md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <p className="text-[15px] font-semibold text-primary">Level {current?.level_no ?? 1}</p>
            <p className="mt-1 font-heading text-[clamp(34px,4vw,52px)] font-extrabold leading-none tracking-[-0.045em]" data-testid="level-name">{current?.name ?? 'Getting started'}</p>
            {next ? (
              <div className="mt-[22px] max-w-[460px]">
                <ProgressBar pct={levelPct} label={`Progress to ${next.name}`} />
                <p className="mt-2 text-[15px] text-grey">{(next.min_xp - xp).toLocaleString('en-IN')} XP to {next.name}</p>
              </div>
            ) : <p className="mt-4 text-[15px] text-grey">You have reached the top level.</p>}
          </div>
          <p className="max-md:text-left md:text-right">
            <span className="block font-heading text-[clamp(44px,5vw,72px)] font-extrabold leading-[.9] tracking-[-0.05em]" data-testid="xp-total">{xp.toLocaleString('en-IN')}</span>
            <span className="mt-1.5 block text-[15px] font-medium text-grey">XP</span>
          </p>
        </div>

        <dl className="mt-7 grid grid-cols-2 border-y-2 border-fg sm:grid-cols-4">
          {stat(streak, 'Day streak', 'streak')}
          {stat(stats.data?.longest_streak ?? 0, 'Best streak')}
          {stat(stats.data?.lessons_completed ?? 0, 'Lessons done')}
          {stat(stats.data?.tests_taken ?? 0, 'Quizzes taken')}
        </dl>

        {showBadges && (badges.data?.length ?? 0) > 0 && (
          <section className="mt-14">
            <h2 className={h2s}>Badges</h2>
            <p className="mt-1.5 text-[17px] text-grey">{earned.size} of {badges.data!.length} earned.</p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {badges.data!.map((b, i) => {
                const when = earned.get(b.id)
                return (
                  <li key={b.id} data-earned={when ? 'yes' : 'no'}
                    className={`flex flex-col gap-3.5 rounded-[22px] p-[22px] ${when ? 'border border-border bg-white' : 'border border-dashed border-border'}`}>
                    <span className={`grid h-[60px] w-[60px] place-items-center rounded-full ${when ? TINTS[i % TINTS.length] : 'bg-[#ECE8DD] text-[#8D9594]'}`}>
                      <Icon name="medal" className="h-[30px] w-[30px]" />
                    </span>
                    <div>
                      <p className={`text-lg font-semibold tracking-[-0.02em] ${when ? '' : 'text-grey'}`}>{b.name} <span className="text-sm font-normal text-mute">{b.tier}</span></p>
                      <p className="mt-1 text-sm leading-snug text-mute">{when ? `Earned ${date(when)}` : (b.description ?? 'Keep going to earn it.')}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {showBoards && (
          <section className="mt-14">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2.5">
              <h2 className={h2s}>Leaderboard</h2>
              <nav aria-label="Leaderboard period" className="flex gap-[22px] text-base">
                {BOARDS.map(([k, l]) => (
                  <Link key={k} href={`/progress?board=${k}`} aria-current={k === boardKey ? 'page' : undefined}
                    className={`pb-1 font-semibold ${k === boardKey ? 'text-fg shadow-[0_3px_0_var(--color-accent)]' : 'text-mute hover:text-fg'}`}>{l}</Link>
                ))}
              </nav>
            </div>
            {lb && lb.entries.length > 0 ? (
              <>
                <ol className="mt-[18px] border-t-2 border-fg" data-testid="leaderboard">
                  {lb.entries.map((e) => (
                    <li key={`${e.rank}-${e.name}`}
                      className={`-mx-2.5 grid grid-cols-[36px_1fr_auto] items-center gap-3 px-2.5 py-3.5 text-[17px] ${e.me ? 'rounded-xl bg-tint-2 font-bold' : 'border-b border-border'}`}>
                      <span className={`font-heading font-extrabold ${e.me ? 'text-fg' : 'text-mute'}`}>{e.rank}</span>
                      <span>{e.name}{e.me ? ' (you)' : ''}</span>
                      <span>{Number(e.score).toLocaleString('en-IN')} XP</span>
                    </li>
                  ))}
                </ol>
                {lb.me && !lb.entries.some((e) => e.me) && <p className="mt-3.5 text-[17px] text-grey">You are #{lb.me.rank} with {Number(lb.me.score).toLocaleString('en-IN')} XP.</p>}
              </>
            ) : <p className="mt-[18px] text-[17px] text-grey">Nobody has earned XP in this period yet. Finish a lesson to get on the board.</p>}
          </section>
        )}
      </section>
    </LearnerShell>
  )
}

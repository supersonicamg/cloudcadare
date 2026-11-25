import Link from 'next/link'
import { startQuiz } from '../quiz-actions'
import { buttonLg, buttonQuiet, h2s } from '@/lib/ui'

export interface QuizOverviewData {
  test_id: string; title: string; instructions: string | null; question_count: number; duration_seconds: number | null
  max_attempts: number | null; pass_pct: number | null; total_marks: number; results_shown: boolean; open_attempt_id: string | null
  attempts: { id: string; attempt_no: number; status: string; submitted_at: string | null; score: number | null; max_score: number | null; percentage: number | null; is_passed: boolean | null }[]
}

const NOTICES: Record<string, string> = {
  attempts: 'You have used all your attempts.', enrol: 'You need to be enrolled in this course to take the quiz.', closed: 'This quiz is not open right now.',
  empty: 'This quiz has no questions yet. Check back soon.', failed: 'The quiz could not be started. Try again.',
}

/** Before the learner starts: what the quiz is, their earlier attempts, and the one button. */
export function QuizOverview({ slug, lessonId, o, notice }: { slug: string; lessonId: string; o: QuizOverviewData; notice?: string }) {
  const used = o.attempts.length
  const left = o.max_attempts === null ? null : Math.max(o.max_attempts - used - (o.open_attempt_id ? 1 : 0), 0)
  const canStart = o.question_count > 0 && (o.open_attempt_id !== null || left === null || left > 0)
  const passed = o.attempts.some((a) => a.is_passed)
  return (
    <div>
      <dl className="grid max-w-md grid-cols-2 gap-x-6 gap-y-2.5 border-y-2 border-fg py-5 text-base">
        <dt className="text-mute">Questions</dt><dd data-testid="quiz-questions">{o.question_count}</dd>
        <dt className="text-mute">Time</dt><dd>{o.duration_seconds ? `${Math.round(o.duration_seconds / 60)} minutes` : 'No limit'}</dd>
        {o.pass_pct !== null && <><dt className="text-mute">To pass</dt><dd>{o.pass_pct}%</dd></>}
        <dt className="text-mute">Attempts</dt><dd>{o.max_attempts === null ? 'Unlimited' : `${used} of ${o.max_attempts} used`}</dd>
      </dl>
      {o.instructions && <p className="mt-6 max-w-2xl whitespace-pre-line text-grey">{o.instructions}</p>}
      {notice && NOTICES[notice] && <p role="alert" className="mt-6 text-[15px] font-semibold text-danger">{NOTICES[notice]}</p>}
      <div className="mt-8">
        {canStart ? (
          <form action={startQuiz.bind(null, slug, lessonId, o.test_id)}>
            <button className={buttonLg}>{o.open_attempt_id ? 'Resume the quiz' : used > 0 ? (passed ? 'Take it again' : 'Try again') : 'Start the quiz'}</button>
          </form>
        ) : o.question_count === 0 ? <p className="text-grey">This quiz has no questions yet.</p> : <p className="text-grey">You have used all your attempts.</p>}
      </div>
      {used > 0 && (
        <section className="mt-12">
          <h2 className={`${h2s} mb-3 !text-2xl`}>Your attempts</h2>
          <ul className="border-t-2 border-fg">
            {o.attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-border py-3 text-[15px]">
                <span>Attempt {a.attempt_no}{a.submitted_at ? <span className="text-mute"> · {new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span> : null}</span>
                <span className="flex items-baseline gap-4">
                  {o.results_shown && a.score !== null ? <span data-testid="attempt-score">{Number(a.score)} of {Number(a.max_score)} · {Math.round(Number(a.percentage))}%{a.is_passed === null ? '' : a.is_passed ? ' · passed' : ' · not passed'}</span> : <span className="text-mute">Result not shown yet</span>}
                  <Link href={`/learn/${slug}/${lessonId}/result/${a.id}`} className={buttonQuiet}>View</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

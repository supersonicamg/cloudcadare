import Link from 'next/link'
import { Ic } from '../../_components/v11'
import { startQuiz } from '../quiz-actions'

export interface QuizOverviewData {
  test_id: string; title: string; instructions: string | null; question_count: number; duration_seconds: number | null
  max_attempts: number | null; pass_pct: number | null; total_marks: number; results_shown: boolean; open_attempt_id: string | null
  attempts: { id: string; attempt_no: number; status: string; submitted_at: string | null; score: number | null; max_score: number | null; percentage: number | null; is_passed: boolean | null }[]
}

const NOTICES: Record<string, string> = {
  attempts: 'You have used all your attempts.', enrol: 'You need to be enrolled in this course to take the quiz.', closed: 'This quiz is not open right now.',
  empty: 'This quiz has no questions yet. Check back soon.', failed: 'The quiz could not be started. Try again.',
}

/** Before the learner starts: what the quiz is in four facts, the one button, and their earlier attempts. */
export function QuizOverview({ slug, lessonId, o, notice }: { slug: string; lessonId: string; o: QuizOverviewData; notice?: string }) {
  const used = o.attempts.length
  const left = o.max_attempts === null ? null : Math.max(o.max_attempts - used - (o.open_attempt_id ? 1 : 0), 0)
  const canStart = o.question_count > 0 && (o.open_attempt_id !== null || left === null || left > 0)
  const passed = o.attempts.some((a) => a.is_passed)
  return (
    <div className="stack">
      <dl className="facts">
        <div><dt>Questions</dt><dd data-testid="quiz-questions">{o.question_count}</dd></div>
        <div><dt>Time</dt><dd>{o.duration_seconds ? `${Math.round(o.duration_seconds / 60)} minutes` : 'No limit'}</dd></div>
        {o.pass_pct !== null && <div><dt>To pass</dt><dd>{o.pass_pct}%</dd></div>}
        <div><dt>Attempts</dt><dd>{o.max_attempts === null ? 'Unlimited' : `${used} of ${o.max_attempts} used`}</dd></div>
      </dl>
      {o.instructions && <p className="t-body" style={{ whiteSpace: 'pre-line', maxWidth: '60ch' }}>{o.instructions}</p>}
      {notice && NOTICES[notice] && <p role="alert" className="note-l"><Ic n="info" s /><span>{NOTICES[notice]}</span></p>}
      <div>
        {canStart ? (
          <form action={startQuiz.bind(null, slug, lessonId, o.test_id)}>
            <button className="btn">{o.open_attempt_id ? 'Resume the quiz' : used > 0 ? (passed ? 'Take it again' : 'Try again') : 'Start the quiz'}</button>
          </form>
        ) : o.question_count === 0 ? <p className="t-body">This quiz has no questions yet.</p> : <p className="t-body">You have used all your attempts.</p>}
      </div>
      {used > 0 && (
        <section className="blk" style={{ marginTop: 16 }} aria-labelledby="qo-h">
          <div className="blk-h"><h2 className="t-h3" id="qo-h">Your attempts</h2></div>
          <ul className="rows">
            {o.attempts.map((a) => (
              <li key={a.id}>
                <div className="row">
                  <span className={`ti${a.is_passed ? ' done' : ''}`}>{a.is_passed ? <Ic n="check" /> : <Ic n="quiz" />}</span>
                  <span className="tx">
                    <b>Attempt {a.attempt_no}</b>
                    <span>{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Not finished'}</span>
                  </span>
                  <span className="rt">
                    {o.results_shown && a.score !== null
                      ? <span data-testid="attempt-score">{Number(a.score)} of {Number(a.max_score)} · {Math.round(Number(a.percentage))}%{a.is_passed === null ? '' : a.is_passed ? ' · passed' : ' · not passed'}</span>
                      : <span>Result not shown yet</span>}
                    <Link href={`/learn/${slug}/${lessonId}/result/${a.id}`} className="link link-s">View</Link>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

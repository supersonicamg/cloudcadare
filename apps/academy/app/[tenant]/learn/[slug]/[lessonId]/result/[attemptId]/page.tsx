import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { getLearnCourse } from '@/lib/learn'
import { getShell } from '@/lib/shell'
import { backLink, buttonLg, buttonLine, chipClass, h1s } from '@/lib/ui'

export const metadata: Metadata = { title: 'Quiz result' }

interface Result {
  title: string; attempt_no: number; status: string; results_shown: boolean; review_shown: boolean
  score: number | null; max_score: number | null; percentage: number | null; correct: number | null; incorrect: number | null; unattempted: number | null
  is_passed: boolean | null; time_taken_seconds: number | null
  review: { id: string; text: string; options: { id: string; content?: { text?: string } }[]; selected: string | string[] | null; correct: string[]; is_correct: boolean | null; marks: number | null; max_marks: number; explanation: string | null }[] | null
}

export default async function QuizResult({ params }: PageProps<'/[tenant]/learn/[slug]/[lessonId]/result/[attemptId]'>) {
  const { slug, lessonId, attemptId } = await params
  if (!z.uuid().safeParse(lessonId).success || !z.uuid().safeParse(attemptId).success) notFound()
  const a = await requireMember(`/learn/${slug}/${lessonId}/result/${attemptId}`)
  const { theme, brand, nav, account, site } = await getShell()
  const courseHome = getLearnCourse(a, slug)
  const { data, error } = await a.db.rpc('get_attempt_result', { p_attempt_id: attemptId })
  if (error) {
    if (error.message.includes('attempt_open')) redirect(`/learn/${slug}/${lessonId}/attempt/${attemptId}`)
    notFound()
  }
  const r = data as unknown as Result
  const chosen = (sel: Result['review'] extends (infer R)[] | null ? R : never, id: string) => (Array.isArray(sel.selected) ? sel.selected.includes(id) : sel.selected === id)

  const course = await courseHome
  const at = course ? course.order.findIndex((l) => l.id === lessonId) : -1
  const next = course && at >= 0 ? course.order[at + 1] : undefined
  const passed = r.results_shown && r.is_passed === true
  const failed = r.results_shown && r.is_passed === false
  const pct = Math.round(Number(r.percentage ?? 0))

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <article className="mx-auto max-w-[880px] px-5 pb-20 pt-8 md:pt-10">
        <Link href={`/learn/${slug}/${lessonId}`} className={backLink}><Icon name="back" />{r.title}</Link>
        <div className="mt-7 flex flex-col items-start gap-3.5">
          <span className={chipClass(passed ? 'ok' : failed ? 'bad' : 'quiet')}>{passed ? 'Passed' : failed ? 'Not passed yet' : 'Submitted'}</span>
          <h1 className={h1s}>{r.results_shown ? (r.is_passed === null ? 'Quiz submitted' : r.is_passed ? 'You passed. Nicely done.' : 'Not quite there yet') : 'Quiz submitted'}</h1>
          {r.results_shown && r.score !== null && (
            <p className="font-heading text-[clamp(64px,8vw,104px)] font-extrabold leading-[.95] tracking-[-0.06em]" data-testid="result-score">
              {Number(r.score)} <small className="text-[.36em] font-semibold tracking-[-0.02em] text-mute">of {Number(r.max_score)}</small>
            </p>
          )}
        </div>
        {r.results_shown && r.score !== null ? (
          <>
            <p className="sr-only" data-testid="result-detail">{pct}% · {r.correct} correct · {r.incorrect} wrong · {r.unattempted} unanswered</p>
            <dl className="mt-7 grid grid-cols-3 justify-start border-y-2 border-fg" aria-hidden="true">
              {[[`${pct}%`, 'Score'], [String(r.correct), 'Correct'], [String(r.incorrect), 'Wrong']].map(([v, l], n) => (
                <div key={l} className={`py-[18px] ${n < 2 ? 'border-r border-border pr-4 max-sm:pr-3' : ''} ${n > 0 ? 'pl-5 max-sm:pl-3' : ''}`}>
                  <dt className="font-heading text-[32px] font-bold tracking-[-0.04em]">{v}</dt><dd className="text-sm text-mute">{l}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : <p className="mt-4 max-w-lg text-lg text-grey">Your answers are recorded. Your result will be shown when the academy publishes it.</p>}
        {failed && <p className="mt-5 text-[17px] text-grey">Read the review below, then try again.</p>}
        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3.5">
          {failed
            ? <Link href={`/learn/${slug}/${lessonId}`} className={`${buttonLg} max-sm:w-full`}>Try again</Link>
            : next
              ? <Link href={`/learn/${slug}/${next.id}`} className={`${buttonLg} max-sm:w-full`}>Next: {next.title} <span aria-hidden="true">→</span></Link>
              : <Link href={`/learn/${slug}/${lessonId}`} className={`${buttonLg} max-sm:w-full`}>Back to the lesson</Link>}
          <Link href={`/learn/${slug}`} className={`${buttonLine} max-sm:w-full`}>Course home</Link>
        </div>

        {r.review && (
          <section className="mt-14">
            <h2 className="font-heading text-[22px] font-bold tracking-[-0.02em]">Review</h2>
            <ol className="mt-3.5 border-t-2 border-fg">
              {r.review.map((q, n) => (
                <li key={q.id} className="border-b border-border py-7" data-testid="review-item">
                  <p className="text-sm text-mute" data-testid="review-verdict">
                    {q.is_correct === true ? <b className="text-ok-ink">Correct</b> : q.selected == null || (Array.isArray(q.selected) && !q.selected.length) ? <b className="text-grey">Not answered</b> : <b className="text-danger-ink">Not correct</b>}
                    <span> · question {n + 1} · {Number(q.marks ?? 0)} of {Number(q.max_marks)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line font-heading text-2xl font-bold leading-tight tracking-[-0.03em]">{q.text}</p>
                  <ul className="mt-5 grid max-w-[640px] gap-3">
                    {q.options.map((o, k) => {
                      const right = q.correct.includes(o.id)
                      const mine = chosen(q, o.id)
                      const tone = right ? 'border-success bg-ok-bg' : mine ? 'border-danger bg-danger-bg' : 'border-border bg-white'
                      const key = right ? 'border-success bg-success text-white' : mine ? 'border-danger bg-danger text-white' : 'border-field'
                      return (
                        <li key={o.id} className={`flex items-center gap-4 rounded-2xl border-2 px-5 py-4 text-lg font-medium leading-snug ${tone}`}>
                          <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${key}`}>{'ABCDEFGHIJKL'[k]}</span>
                          <span>{o.content?.text}</span>
                          <em className="ml-auto whitespace-nowrap text-sm font-semibold not-italic">{[mine ? 'Your answer' : null, right ? 'Correct answer' : null].filter(Boolean).join(' · ')}</em>
                        </li>
                      )
                    })}
                  </ul>
                  {q.explanation && <div className="mt-4 max-w-[640px] rounded-[14px] bg-tint-2 px-5 py-4 text-base leading-snug"><b className="mb-1 block">Explanation</b>{q.explanation}</div>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </theme.SiteLayout>
  )
}

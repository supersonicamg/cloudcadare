import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/lib/dal'
import { getLearnCourse, getLessonContent } from '@/lib/learn'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../../../../../_components/learner-shell'
import { placeOf } from '../../../../_components/lesson-meta'
import type { QuizOverviewData } from '../../../../_components/quiz-overview'
import '../../../../_components/study.css'
import { ReviewList, type ReviewItem } from './review-list'

export const metadata: Metadata = { title: 'Quiz result' }

interface Result {
  title: string; attempt_no: number; status: string; results_shown: boolean; review_shown: boolean
  score: number | null; max_score: number | null; percentage: number | null; correct: number | null; incorrect: number | null; unattempted: number | null
  is_passed: boolean | null; time_taken_seconds: number | null
  review: { id: string; text: string; options: { id: string; content?: { text?: string } }[]; selected: string | string[] | null; correct: string[]; is_correct: boolean | null; marks: number | null; max_marks: number; explanation: string | null }[] | null
}

/*
 * The result: the score is the picture (a big numeral, like a calendar day), then one sentence, then the way on.
 * Wrong answers show the right one in the same row, in plain words; no red. Next lesson is the one filled button.
 */
export default async function QuizResult({ params }: PageProps<'/[tenant]/learn/[slug]/[lessonId]/result/[attemptId]'>) {
  const { slug, lessonId, attemptId } = await params
  if (!z.uuid().safeParse(lessonId).success || !z.uuid().safeParse(attemptId).success) notFound()
  const a = await requireMember(`/learn/${slug}/${lessonId}/result/${attemptId}`)
  const shell = await getShell()
  const courseHome = getLearnCourse(a, slug)
  const lessonHome = getLessonContent(a, lessonId)
  const { data, error } = await a.db.rpc('get_attempt_result', { p_attempt_id: attemptId })
  if (error) {
    if (error.message.includes('attempt_open')) redirect(`/learn/${slug}/${lessonId}/attempt/${attemptId}`)
    notFound()
  }
  const r = data as unknown as Result

  const course = await courseHome
  const at = course ? course.order.findIndex((l) => l.id === lessonId) : -1
  const next = course && at >= 0 ? course.order[at + 1] : undefined
  const place = placeOf(course?.sections, lessonId)

  // The quiz's own rules (pass mark, tries) live on its overview; the result itself does not carry them.
  const lesson = await lessonHome
  const ov = lesson?.testId ? await a.db.rpc('get_test_overview', { p_test_id: lesson.testId }) : null
  const o = ov && !ov.error ? (ov.data as unknown as QuizOverviewData | null) : null
  const left = o && o.max_attempts !== null ? Math.max(o.max_attempts - o.attempts.length - (o.open_attempt_id ? 1 : 0), 0) : null
  const canRetry = Boolean(o && o.question_count > 0 && (left === null || left > 0))

  const passed = r.results_shown && r.is_passed === true
  const failed = r.results_shown && r.is_passed === false
  const pct = Math.round(Number(r.percentage ?? 0))
  const minutes = r.time_taken_seconds ? `${Math.max(1, Math.round(r.time_taken_seconds / 60))} ${Math.round(r.time_taken_seconds / 60) <= 1 ? 'minute' : 'minutes'}` : null
  const sentence = [
    o && o.pass_pct !== null ? `You needed ${o.pass_pct}% to pass.` : null,
    `Attempt ${r.attempt_no}${o && o.max_attempts !== null ? ` of ${o.max_attempts}` : ''}${minutes ? ` · ${minutes}` : ''}`,
  ].filter(Boolean).join(' ') + '.'

  const textOf = (q: NonNullable<Result['review']>[number], ids: string[]) => q.options.filter((x) => ids.includes(x.id)).map((x) => x.content?.text ?? '').filter(Boolean).join(', ')
  const items: ReviewItem[] = (r.review ?? []).map((q, n) => {
    const mine = q.selected == null ? [] : Array.isArray(q.selected) ? q.selected : [q.selected]
    const right = q.is_correct === true ? true : mine.length === 0 ? null : false
    return {
      id: q.id, n: n + 1, text: q.text, right, yours: mine.length ? textOf(q, mine) : null, answer: textOf(q, q.correct),
      marks: `${Number(q.marks ?? 0)} of ${Number(q.max_marks)} ${Number(q.max_marks) === 1 ? 'mark' : 'marks'}`, explanation: q.explanation,
    }
  })

  const retry = canRetry && (failed || passed) ? `${failed ? 'Try again' : 'Take it again'}${left !== null ? ` (${left} ${left === 1 ? 'try' : 'tries'} left)` : ''}` : null
  const forward = next
    ? { href: `/learn/${slug}/${next.id}`, label: `Next lesson: ${next.title}` }
    : { href: `/learn/${slug}/material`, label: 'Back to my course' }

  return (
    <LearnerShell a={a} shell={shell} active="lessons" focus={{ backHref: `/learn/${slug}/material`, backLabel: 'My course', where: place ? `${place.label} · ${r.title}` : r.title }}>
      <div className="qz">
        {r.results_shown && r.score !== null ? (
          <div className="score"><b data-testid="result-score">{Number(r.score)}</b><span className="t-h3">out of {Number(r.max_score)}</span></div>
        ) : null}
        <h1 className="t-title" style={{ marginTop: 12 }}>
          {r.results_shown && r.is_passed !== null ? (r.is_passed ? `You passed the ${r.title}` : 'Not quite there yet') : `${r.title} submitted`}
        </h1>
        {r.results_shown && r.score !== null ? (
          <>
            <p className="t-lead" style={{ marginTop: 8 }}>{sentence}</p>
            <p className="sr" data-testid="result-detail">{pct}% · {r.correct} correct · {r.incorrect} wrong · {r.unattempted} unanswered</p>
          </>
        ) : <p className="t-lead" style={{ marginTop: 8 }}>Your answers are recorded. Your result will be shown when the academy publishes it.</p>}
        {failed && items.length > 0 && <p className="t-body" style={{ marginTop: 8 }}>Read your answers below, then try again.</p>}

        <div className="acts">
          {failed && retry
            ? <>
                <Link href={forward.href} className="btn btn-line btn-sm">{forward.label}</Link>
                <Link href={`/learn/${slug}/${lessonId}`} className="btn">{retry}</Link>
              </>
            : <>
                {retry ? <Link href={`/learn/${slug}/${lessonId}`} className="btn btn-line btn-sm">{retry}</Link> : <Link href={`/learn/${slug}/${lessonId}`} className="link link-s">Back to the quiz</Link>}
                <Link href={forward.href} className="btn">{forward.label}</Link>
              </>}
        </div>

        {items.length > 0 && <ReviewList items={items} />}
      </div>
    </LearnerShell>
  )
}

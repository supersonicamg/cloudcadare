import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireAccess } from '@/lib/dal'
import { removeQuestion } from '../actions'
import { QuestionForm, QuizSettingsForm, type QuestionValues } from './forms'

export const metadata = { title: 'Quiz' }

interface Opt { id: string; content?: { text?: string } }
const TYPE: Record<string, string> = { mcq_single: 'One correct answer', mcq_multi: 'Several correct answers', true_false: 'True or false' }

export default async function QuizEditor({ params, searchParams }: PageProps<'/[tenant]/admin/courses/[id]/quiz/[lessonId]'>) {
  const { id, lessonId } = await params
  const { q: editing } = await searchParams
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(lessonId).success) notFound()
  const a = await requireAccess({ permission: 'test.manage', feature: 'assess.quizzes' }, `/admin/courses/${id}/quiz/${lessonId}`)

  const { data: lesson } = await a.db.from('lessons').select('id, title, test_id').eq('id', lessonId).eq('course_id', id).eq('type', 'quiz').is('deleted_at', null).maybeSingle()
  if (!lesson?.test_id) notFound()
  const testId = lesson.test_id
  const [test, links, attempts] = await Promise.all([
    a.db.from('tests').select('title, instructions, duration_seconds, max_attempts, shuffle_questions, shuffle_options, settings, total_marks, pass_marks').eq('id', testId).maybeSingle(),
    a.db.from('test_questions').select('question_id, position').eq('test_id', testId).order('position'),
    a.db.from('test_attempts').select('id, attempt_no, status, score, max_score, percentage, is_passed, submitted_at, tenant_members(display_name, email)').eq('test_id', testId).neq('status', 'in_progress').order('submitted_at', { ascending: false }).limit(50),
  ])
  if (!test.data) notFound()
  const ids = (links.data ?? []).map((l) => l.question_id)
  const [qs, keys] = ids.length
    ? await Promise.all([
        a.db.from('questions').select('id, type, stem, options, explanation, default_marks').in('id', ids).is('deleted_at', null),
        a.db.from('question_keys').select('question_id, answer').in('question_id', ids),
      ])
    : [{ data: [] }, { data: [] }]
  const byId = new Map((qs.data ?? []).map((q) => [q.id, q]))
  const keyOf = new Map((keys.data ?? []).map((k) => [k.question_id, ((k.answer ?? {}) as { correct?: string[] }).correct ?? []]))
  const questions = ids.flatMap((qid) => { const q = byId.get(qid); return q ? [q] : [] })

  const toValues = (qid: string): QuestionValues | null => {
    const q = byId.get(qid)
    if (!q) return null
    const opts = (q.options ?? []) as unknown as Opt[]
    return {
      id: q.id, type: q.type, text: ((q.stem ?? {}) as { text?: string }).text ?? '', marks: Number(q.default_marks),
      explanation: ((q.explanation ?? {}) as { text?: string } | null)?.text ?? '',
      options: Object.fromEntries(opts.map((o) => [o.id, o.content?.text ?? ''])), correct: keyOf.get(q.id) ?? [],
    }
  }
  const edit = typeof editing === 'string' && z.uuid().safeParse(editing).success ? toValues(editing) : null
  const settings = (test.data.settings ?? {}) as { pass_pct?: number }
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null

  return (
    <>
      <Link href={`/admin/courses/${id}`} className="text-sm text-fg/65 hover:text-fg">&larr; Back to the course</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{test.data.title}</h1>
      <p className="mt-1 text-fg/65">Quiz · {questions.length} {questions.length === 1 ? 'question' : 'questions'} · {Number(test.data.total_marks)} marks{test.data.pass_marks ? ` · pass at ${Number(test.data.pass_marks)}` : ''}</p>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Settings</h2>
        <QuizSettingsForm courseId={id} lessonId={lessonId} testId={testId} v={{
          title: test.data.title, instructions: ((test.data.instructions ?? {}) as { text?: string } | null)?.text ?? '',
          passPct: settings.pass_pct ?? null, minutes: test.data.duration_seconds ? Math.round(test.data.duration_seconds / 60) : null,
          maxAttempts: test.data.max_attempts, shuffleQuestions: test.data.shuffle_questions, shuffleOptions: test.data.shuffle_options,
        }} />
      </section>

      <section className="mt-14">
        <h2 className="mb-1 text-xl font-semibold">Questions</h2>
        <p className="mb-4 text-fg/70">Learners see these in this order{test.data.shuffle_questions ? ' (shuffled)' : ''}. Learners who already took the quiz keep their result if you change a question.</p>
        {questions.length > 0 && (
          <ol className="border-t border-border">
            {questions.map((q, i) => (
              <li key={q.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border py-3">
                <div>
                  <p className="font-medium"><span className="mr-2 text-fg/60">{i + 1}.</span>{((q.stem ?? {}) as { text?: string }).text}</p>
                  <p className="text-sm text-fg/65">{TYPE[q.type] ?? q.type} · {Number(q.default_marks)} {Number(q.default_marks) === 1 ? 'mark' : 'marks'}</p>
                </div>
                <span className="flex items-baseline gap-4 text-sm">
                  <Link href={`/admin/courses/${id}/quiz/${lessonId}?q=${q.id}#question-form`} className="text-primary hover:underline">Edit</Link>
                  <form action={removeQuestion.bind(null, id, lessonId, testId, q.id)}><button className="text-fg/60 hover:text-danger hover:underline">Remove</button></form>
                </span>
              </li>
            ))}
          </ol>
        )}
        <div id="question-form" className="mt-8">
          <h3 className="mb-3 font-medium">{edit ? 'Edit question' : 'Add a question'}</h3>
          <QuestionForm key={edit?.id ?? 'new'} courseId={id} lessonId={lessonId} testId={testId} v={edit} />
          {edit && <p className="mt-3 text-sm"><Link href={`/admin/courses/${id}/quiz/${lessonId}`} className="text-fg/65 underline hover:text-fg">Cancel and add a new question instead</Link></p>}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-xl font-semibold">Results</h2>
        {attempts.data?.length ? (
          <ul className="border-t border-border">
            {attempts.data.map((t) => {
              const m = one(t.tenant_members)
              return (
                <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-border py-2.5 text-[15px]">
                  <span>{m?.display_name} <span className="text-fg/60">{m?.email} · attempt {t.attempt_no}</span></span>
                  <span data-testid="attempt-row">{t.score === null ? 'Not graded' : `${Number(t.score)} of ${Number(t.max_score)} · ${Math.round(Number(t.percentage))}%`}{t.is_passed === null ? '' : t.is_passed ? ' · passed' : ' · not passed'}</span>
                </li>
              )
            })}
          </ul>
        ) : <p className="text-fg/70">Nobody has taken this quiz yet.</p>}
      </section>
    </>
  )
}

'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'

export type QuizState = { error?: string; saved?: boolean }

const need = { permission: 'test.manage', feature: 'assess.quizzes' } as const
const optional = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim(); return s || null }

function message(e: unknown): string {
  if (e instanceof MfaRequired) return 'This needs the two-step check first. Open Security, verify your code, then try again.'
  if (e instanceof ActionDenied) return 'You do not have permission to do that.'
  return 'Something went wrong. Try again.'
}

const DB_ERRORS: Record<string, string> = {
  question_text_invalid: 'Write the question.',
  options_invalid: 'Give at least two options, each with text.',
  answer_invalid: 'Mark the correct answer. A single-answer question has exactly one.',
  marks_invalid: 'Marks must be between 0 and 100.',
  not_allowed: 'You do not have permission to edit quizzes.',
}
const dbMessage = (m: string) => DB_ERRORS[Object.keys(DB_ERRORS).find((k) => m.includes(k)) ?? ''] ?? 'Something went wrong. Try again.'

const settings = z.object({
  title: z.string().trim().min(2, 'Give the quiz a title.').max(160),
  instructions: z.string().trim().max(2000).nullable(),
  passPct: z.number().min(1).max(100).nullable(),
  minutes: z.number().int().min(1).max(600).nullable(),
  maxAttempts: z.number().int().min(1).max(100).nullable(),
})

export async function updateQuiz(courseId: string, lessonId: string, testId: string, _s: QuizState, form: FormData): Promise<QuizState> {
  const num = (k: string) => { const v = optional(form.get(k)); return v === null ? null : Number(v) }
  const parsed = settings.safeParse({ title: form.get('title'), instructions: optional(form.get('instructions')), passPct: num('pass_pct'), minutes: num('minutes'), maxAttempts: num('max_attempts') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form: pass mark is a percentage, time and attempts are whole numbers.' }
  const v = parsed.data
  try {
    const a = await requireActionAccess(need)
    const { data: cur } = await a.db.from('tests').select('settings, total_marks').eq('id', testId).eq('course_id', courseId).maybeSingle()
    if (!cur) return { error: 'That quiz was not found.' }
    const { pass_pct: _old, ...rest } = (cur.settings ?? {}) as Record<string, unknown>
    const { error } = await a.db.from('tests').update({
      title: v.title, instructions: v.instructions ? { text: v.instructions } : null, duration_seconds: v.minutes ? v.minutes * 60 : null,
      max_attempts: v.maxAttempts, shuffle_questions: form.get('shuffle_questions') === 'on', shuffle_options: form.get('shuffle_options') === 'on',
      settings: { ...rest, ...(v.passPct ? { pass_pct: v.passPct } : {}) } as { [k: string]: never },
      pass_marks: v.passPct ? Math.round(Number(cur.total_marks) * v.passPct) / 100 : null,
    }).eq('id', testId)
    if (error) return { error: message(error) }
    await a.db.from('lessons').update({ title: v.title, duration_seconds: v.minutes ? v.minutes * 60 : null }).eq('id', lessonId).eq('test_id', testId)
    updateTag(`tenant:${a.bundle.tenant.id}:catalog`)
    revalidatePath(`/admin/courses/${courseId}/quiz/${lessonId}`)
    return { saved: true }
  } catch (e) {
    return { error: message(e) }
  }
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

export async function saveQuestion(courseId: string, lessonId: string, testId: string, questionId: string | null, _s: QuizState, form: FormData): Promise<QuizState> {
  const type = z.enum(['mcq_single', 'mcq_multi', 'true_false']).safeParse(form.get('type'))
  if (!type.success) return { error: 'Choose a question type.' }
  const marks = Number(optional(form.get('marks')) ?? 1)
  if (!Number.isFinite(marks) || marks <= 0 || marks > 100) return { error: 'Marks must be between 0 and 100.' }
  const text = String(form.get('text') ?? '').trim()
  if (!text) return { error: 'Write the question.' }

  let options: { id: string; text: string }[] = []
  let correct: string[]
  if (type.data === 'true_false') {
    const tf = String(form.get('tf') ?? '')
    if (tf !== 'true' && tf !== 'false') return { error: 'Say whether the statement is true or false.' }
    correct = [tf]
  } else {
    options = LETTERS.map((id) => ({ id, text: String(form.get(`option_${id}`) ?? '').trim() })).filter((o) => o.text)
    const picked = form.getAll('correct').map(String).filter((c) => options.some((o) => o.id === c))
    if (options.length < 2) return { error: 'Give at least two options.' }
    if (picked.length === 0) return { error: 'Mark the correct answer.' }
    if (type.data === 'mcq_single' && picked.length !== 1) return { error: 'A single-answer question has exactly one correct option.' }
    correct = picked
  }

  try {
    const a = await requireActionAccess(need)
    // a null question id creates a new question (the generated type does not allow null)
    const { error } = await a.db.rpc('save_quiz_question', {
      p_test_id: testId, p_question_id: questionId as string, p_type: type.data, p_text: text,
      p_options: options, p_correct: correct, p_marks: marks, p_explanation: String(form.get('explanation') ?? ''),
    })
    if (error) return { error: dbMessage(error.message) }
    revalidatePath(`/admin/courses/${courseId}/quiz/${lessonId}`)
    return { saved: true }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function removeQuestion(courseId: string, lessonId: string, testId: string, questionId: string, _form: FormData): Promise<void> {
  const a = await requireActionAccess(need)
  const { error } = await a.db.rpc('delete_quiz_question', { p_test_id: testId, p_question_id: questionId })
  if (error) throw new Error('could not delete the question')
  revalidatePath(`/admin/courses/${courseId}/quiz/${lessonId}`)
}

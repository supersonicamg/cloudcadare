'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { ActionDenied, requireMemberAction } from '@/lib/dal'
import { kickOutbox } from '@/lib/outbox'

// The quiz engine lives in the database (start/save/submit RPCs): it owns the clock, the paper and the grading.
// These actions only carry the learner's calls to it as THEM (user-scoped client), so membership and
// enrolment checks happen in the database.

const START_ERRORS: Record<string, string> = {
  max_attempts_reached: 'attempts', not_enrolled: 'enrol', test_not_open: 'closed', test_closed: 'closed', test_has_no_questions: 'empty', test_not_available: 'empty',
}

export async function startQuiz(slug: string, lessonId: string, testId: string, _form: FormData): Promise<void> {
  if (!z.uuid().safeParse(testId).success || !z.uuid().safeParse(lessonId).success) redirect(`/learn/${slug}`)
  let target: string
  try {
    const a = await requireMemberAction()
    const { data, error } = await a.db.rpc('start_test_attempt', { p_test_id: testId })
    if (error) {
      const code = START_ERRORS[Object.keys(START_ERRORS).find((k) => error.message.includes(k)) ?? ''] ?? 'failed'
      target = `/learn/${slug}/${lessonId}?quiz=${code}`
    } else target = `/learn/${slug}/${lessonId}/attempt/${data as string}`
  } catch (e) {
    if (!(e instanceof ActionDenied)) throw e
    target = `/login?next=${encodeURIComponent(`/learn/${slug}/${lessonId}`)}`
  }
  redirect(target)
}

const response = z.object({ selected: z.union([z.string().max(10), z.array(z.string().max(10)).max(8)]).nullable() })

/** One answer, saved as the learner picks it. `closed` means the time is up and the database already submitted. */
export async function saveAnswer(attemptId: string, questionId: string, raw: unknown, flagged: boolean): Promise<{ ok: boolean; closed?: boolean }> {
  const r = response.safeParse(raw)
  if (!r.success || !z.uuid().safeParse(attemptId).success || !z.uuid().safeParse(questionId).success) return { ok: false }
  try {
    const a = await requireMemberAction()
    const { data, error } = await a.db.rpc('save_attempt_answer', { p_attempt_id: attemptId, p_question_id: questionId, p_response: r.data, p_flagged: flagged })
    if (error) return { ok: false }
    return { ok: true, closed: (data as { status?: string } | null)?.status === 'closed' }
  } catch {
    return { ok: false }
  }
}

export async function submitAttempt(attemptId: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(attemptId).success) return { ok: false }
  try {
    const a = await requireMemberAction()
    const { error } = await a.db.rpc('submit_test_attempt', { p_attempt_id: attemptId })
    if (!error) kickOutbox() // passing may have completed the course and earned a certificate
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}

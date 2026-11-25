'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'
import type { KeepState } from '@/lib/use-keep-form'

const NEED = { permission: 'enrollment.manage', feature: 'catalog.courses' } as const

function message(e: unknown): string {
  if (e instanceof MfaRequired) return 'This needs the two-step check first. Open My security, enter your code, then try again.'
  if (e instanceof ActionDenied) return 'You do not have permission to do that.'
  return 'Something went wrong. Try again.'
}

export async function grantAccess(_s: KeepState, form: FormData): Promise<KeepState> {
  const parsed = z.object({ email: z.email().max(254), courseId: z.uuid() })
    .safeParse({ email: String(form.get('email') ?? '').trim().toLowerCase(), courseId: form.get('course_id') })
  if (!parsed.success) return { error: 'Enter the learner’s email and choose a course.' }
  try {
    const a = await requireActionAccess(NEED)
    const { data: member } = await a.db.from('tenant_members').select('id, display_name').eq('email', parsed.data.email).eq('status', 'active').maybeSingle()
    if (!member) return { error: 'No one has signed up with that email yet. Ask them to sign up, or approve their email in advance.' }
    const { data: course } = await a.db.from('courses').select('title').eq('id', parsed.data.courseId).is('deleted_at', null).maybeSingle()
    if (!course) return { error: 'That course was not found.' }
    const { error } = await a.db.rpc('grant_enrollment', { p_member_id: member.id, p_course_id: parsed.data.courseId })
    if (error) return { error: error.message.includes('mfa_required') ? message(new MfaRequired()) : error.message.includes('not_allowed') ? message(new ActionDenied()) : 'Could not give access. Try again.' }
    revalidatePath('/admin/enrolments')
    return { saved: true, message: `${member.display_name} now has access to ${course.title}.` }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function revokeAccess(enrollmentId: string, _form: FormData): Promise<void> {
  const a = await requireActionAccess(NEED)
  const { error } = await a.db.rpc('revoke_enrollment', { p_enrollment_id: z.uuid().parse(enrollmentId) })
  if (error) throw new Error('Could not remove access')
  revalidatePath('/admin/enrolments')
}

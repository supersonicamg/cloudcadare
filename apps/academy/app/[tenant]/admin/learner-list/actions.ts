'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { parseLearnerList } from '@educore/core/accounts'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'

const NEED = { permission: 'enrollment.manage', feature: 'catalog.courses' } as const

export interface AddResult {
  error?: string
  /** What happened to each address. Never silent: staff see every group. */
  done?: { added: string[]; existing: string[]; hasAccess: string[]; invalid: string[]; repeats: string[]; expiresAt: string | null }
}

function problem(e: unknown): string {
  if (e instanceof MfaRequired) return 'This needs the two-step check first. Open Security, verify your code, then try again.'
  if (e instanceof ActionDenied) return 'You do not have permission to do that.'
  return 'Something went wrong. Try again.'
}

const dbError = (m: string) =>
  m.includes('mfa_required') ? problem(new MfaRequired())
  : m.includes('not_allowed') ? problem(new ActionDenied())
  : m.includes('expiry_in_past') ? 'The access end date is in the past. Choose a later date.'
  : m.includes('course_not_found') ? 'That course was not found.'
  : m.includes('too_many_entries') ? 'Add at most 500 emails at a time.'
  : 'Could not save. Try again.'

export async function addToList(_prev: AddResult, form: FormData): Promise<AddResult> {
  const ids = z.object({ course: z.uuid(), batch: z.uuid().nullable(), until: z.iso.date().nullable() }).safeParse({
    course: form.get('course_id'),
    batch: form.get('batch_id') || null,
    until: form.get('until') || null,
  })
  if (!ids.success) return { error: 'Choose a course. If you set an end date, use a real date.' }
  const parsed = parseLearnerList(String(form.get('emails') ?? ''))
  if (parsed.tooMany) return { error: 'Add at most 500 emails at a time.' }
  if (!parsed.valid.length) return { error: parsed.invalid.length ? 'None of these look like email addresses.' : 'Paste at least one email.' }

  try {
    const a = await requireActionAccess(NEED)
    const { data, error } = await a.db.rpc('add_to_learner_list', {
      p_tenant_id: a.bundle.tenant.id, p_course_id: ids.data.course, p_batch_id: ids.data.batch,
      // The end of the chosen day, India time, so "until 31 Jul" includes the 31st.
      p_expires: ids.data.until ? `${ids.data.until}T23:59:59+05:30` : null,
      p_entries: parsed.valid.map((e) => ({ email: e.email, name: e.name ?? '' })),
    })
    if (error) return { error: dbError(error.message) }
    const r = data as { added: string[]; existing: string[]; has_access: string[]; invalid: string[]; expires_at: string | null }
    revalidatePath('/admin/learner-list')
    return { done: { added: r.added, existing: r.existing, hasAccess: r.has_access, invalid: [...parsed.invalid, ...r.invalid], repeats: parsed.repeats, expiresAt: r.expires_at } }
  } catch (e) {
    return { error: problem(e) }
  }
}

export async function removeFromList(id: string, _form: FormData): Promise<void> {
  const a = await requireActionAccess(NEED)
  const { error } = await a.db.rpc('remove_from_learner_list', { p_id: z.uuid().parse(id) })
  if (error) throw new Error(dbError(error.message))
  revalidatePath('/admin/learner-list')
}

export async function extendEntry(id: string, form: FormData): Promise<void> {
  const until = z.iso.date().parse(form.get('until'))
  const a = await requireActionAccess(NEED)
  const { error } = await a.db.rpc('extend_learner_list_entry', { p_id: z.uuid().parse(id), p_expires: `${until}T23:59:59+05:30` })
  if (error) throw new Error(dbError(error.message))
  revalidatePath('/admin/learner-list')
}

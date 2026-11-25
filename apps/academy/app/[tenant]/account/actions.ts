'use server'

import { revalidatePath } from 'next/cache'
import { createServerDb, getPlane } from '@educore/auth'
import { PASSWORD_MAX, PASSWORD_MIN, normaliseWhatsapp } from '@educore/core/accounts'
import { ActionDenied, requireMemberAction } from '@/lib/dal'

// Account actions (plan/16 §7). Every one acts on the signed-in member only: the tenant comes from the Host header,
// the person from the verified session, and the database functions check membership again.

export interface FormState { ok?: string; error?: string; field?: string }

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

export async function saveProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const name = text(form, 'name')
  const city = text(form, 'city')
  const cert = text(form, 'certificate_name')
  const rawPhone = text(form, 'whatsapp')

  if (name.length < 2 || name.length > 80) return { error: 'Enter your full name (2 to 80 characters).', field: 'name' }
  const phone = rawPhone ? normaliseWhatsapp(rawPhone) : null
  if (rawPhone && !phone) return { error: 'Enter a 10-digit mobile number, or start with + and your country code.', field: 'whatsapp' }
  if (city.length > 60) return { error: 'Keep the city under 60 characters.', field: 'city' }
  if (cert.length > 80) return { error: 'Keep the certificate name under 80 characters.', field: 'certificate_name' }

  try {
    const a = await requireMemberAction()
    const { data, error } = await a.db.rpc('update_my_profile', {
      p_tenant_id: a.bundle.tenant.id, p_display_name: name, p_phone: phone ?? '', p_city: city, p_certificate_name: cert,
    })
    if (error) return { error: 'We could not save your details. Try again in a minute.' }
    revalidatePath('/account')
    const locked = (data as { certificate_name_locked?: boolean } | null)?.certificate_name_locked
    return { ok: locked && cert ? 'Saved. Your certificate name stays as it was printed.' : 'Saved.' }
  } catch (e) {
    if (e instanceof ActionDenied) return { error: 'Log in again to save your details.' }
    throw e
  }
}

const REMINDERS = {
  'live_class.reminder:whatsapp': true, 'live_class.reminder:email': true, 'material.new:email': true,
} as const
export type ReminderKey = keyof typeof REMINDERS

/** One switch = one row in notification_preferences (member, event, channel). RLS limits it to the caller's own rows. */
export async function setReminder(key: ReminderKey, enabled: boolean): Promise<FormState> {
  if (!(key in REMINDERS)) return { error: 'Unknown reminder.' }
  const [event, channel] = key.split(':') as [string, string]
  try {
    const a = await requireMemberAction()
    const { error } = await a.db.from('notification_preferences').upsert(
      { tenant_id: a.bundle.tenant.id, member_id: a.memberId, event_key: event, channel, enabled },
      { onConflict: 'member_id,event_key,channel' },
    )
    return error ? { error: 'We could not save that. Try again.' } : { ok: 'Saved.' }
  } catch (e) {
    if (e instanceof ActionDenied) return { error: 'Log in again to change this.' }
    throw e
  }
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const current = String(form.get('current') ?? '')
  const next = String(form.get('next') ?? '')
  const again = String(form.get('again') ?? '')
  if (!current) return { error: 'Enter your current password.', field: 'current' }
  if (next.length < PASSWORD_MIN) return { error: `Use at least ${PASSWORD_MIN} characters.`, field: 'next' }
  if (next.length > PASSWORD_MAX) return { error: `Use at most ${PASSWORD_MAX} characters.`, field: 'next' }
  if (next !== again) return { error: 'The two new passwords are not the same.', field: 'again' }
  if (next === current) return { error: 'Choose a password you have not used just now.', field: 'next' }

  try {
    const a = await requireMemberAction()
    const { data: claims } = await a.db.auth.getClaims()
    const email = claims?.claims?.email
    if (!email) return { error: 'Log in again to change your password.' }

    // Check the current password on a throwaway client (its cookies go nowhere), then end that extra session,
    // so the check does not log this device in a second time or leave a stray device in the list.
    const plane = getPlane(a.bundle.tenant.planeId)
    const probe = createServerDb(plane, { getAll: () => [], set: () => {} })
    const check = await probe.auth.signInWithPassword({ email, password: current })
    if (check.error) {
      return check.error.status === 429
        ? { error: 'Too many tries. Wait a few minutes and try again.' }
        : { error: 'That is not your current password.', field: 'current' }
    }
    await probe.auth.signOut({ scope: 'local' }) // default scope is global and would end THIS learner's real session too

    const { error } = await a.db.auth.updateUser({ password: next })
    if (error) return { error: error.code === 'weak_password' ? 'Choose a stronger password.' : 'We could not change your password. Try again in a minute.', field: error.code === 'weak_password' ? 'next' : undefined }
    await a.db.auth.signOut({ scope: 'others' })
    revalidatePath('/account/security')
    return { ok: 'Password updated. Other devices were logged out.' }
  } catch (e) {
    if (e instanceof ActionDenied) return { error: 'Log in again to change your password.' }
    throw e
  }
}

export async function endSession(id: string): Promise<FormState> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Unknown device.' }
  try {
    const a = await requireMemberAction()
    const { error } = await a.db.rpc('end_my_session', { p_session_id: id })
    if (error) return { error: 'We could not log that device out.' }
    revalidatePath('/account/security')
    return { ok: 'Logged out.' }
  } catch (e) {
    if (e instanceof ActionDenied) return { error: 'Log in again first.' }
    throw e
  }
}

export async function endOtherSessions(): Promise<FormState> {
  try {
    const a = await requireMemberAction()
    const { error } = await a.db.auth.signOut({ scope: 'others' })
    if (error) return { error: 'We could not log the other devices out.' }
    revalidatePath('/account/security')
    return { ok: 'Other devices were logged out.' }
  } catch (e) {
    if (e instanceof ActionDenied) return { error: 'Log in again first.' }
    throw e
  }
}

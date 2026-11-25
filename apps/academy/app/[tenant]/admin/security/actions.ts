'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { safeAdminNext } from '@/lib/admin-next'
import { ActionDenied, requireActionAccess } from '@/lib/dal'

// Staff two-step sign-in (TOTP). Supabase Auth holds the factors; a verified code upgrades this session
// to aal2, which the DAL requires for sensitive permissions (prices, gateway keys, access grants...).

export type EnrolStart = { factorId: string; qr: string; secret: string } | { error: string }
export type StepResult = { error: string } | undefined

const code = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.')

export async function startEnrol(): Promise<EnrolStart> {
  try {
    const a = await requireActionAccess({ permission: 'member.view' })
    // a half-finished earlier attempt would otherwise pile up
    const { data: list } = await a.db.auth.mfa.listFactors()
    for (const f of list?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') await a.db.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await a.db.auth.mfa.enroll({
      factorType: 'totp', issuer: a.bundle.branding.displayName, friendlyName: `${a.memberName} ${Math.random().toString(36).slice(2, 8)}`,
    })
    if (error || !data) return { error: 'Could not start setup. Try again in a moment.' }
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
  } catch (e) {
    return { error: e instanceof ActionDenied ? 'You are signed out. Sign in again.' : 'Something went wrong. Try again.' }
  }
}

export async function finishEnrol(factorId: string, next: string, _prev: StepResult, form: FormData): Promise<StepResult> {
  const c = code.safeParse(form.get('code'))
  if (!c.success) return { error: c.error.issues[0]!.message }
  try {
    const a = await requireActionAccess({ permission: 'member.view' })
    const { error } = await a.db.auth.mfa.challengeAndVerify({ factorId: z.uuid().parse(factorId), code: c.data })
    if (error) return { error: 'That code is not right. Codes change every 30 seconds, so try the current one.' }
  } catch {
    return { error: 'Something went wrong. Try again.' }
  }
  redirect(safeAdminNext(next))
}

export async function verifyStep(next: string, _prev: StepResult, form: FormData): Promise<StepResult> {
  const c = code.safeParse(form.get('code'))
  if (!c.success) return { error: c.error.issues[0]!.message }
  try {
    const a = await requireActionAccess({ permission: 'member.view' })
    const { data } = await a.db.auth.mfa.listFactors()
    const factor = data?.totp[0] // listFactors().totp holds verified TOTP factors only
    if (!factor) return { error: 'No authenticator app is set up for this account yet.' }
    const { error } = await a.db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: c.data })
    if (error) return { error: 'That code is not right. Codes change every 30 seconds, so try the current one.' }
  } catch {
    return { error: 'Something went wrong. Try again.' }
  }
  redirect(safeAdminNext(next))
}

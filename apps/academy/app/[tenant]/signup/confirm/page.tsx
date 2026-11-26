import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { safeNext } from '@educore/core/accounts'
import { requireMember } from '@/lib/dal'
import { emailCodeRequired } from '@/lib/email-code'
import { getShell } from '@/lib/shell'
import { AuthFrame, AuthTop } from '../../login/auth-frame'
import { ConfirmForm } from './confirm-form'

export const metadata = { title: 'Confirm your email' }

/*
 * Confirm email.
 * 1. One job: prove the learner owns this email address, before anything is granted.
 * 2. One main action: "Confirm email".
 * 3. Reading order: "Check your email" -> where the code went (one line, the address in ink) -> six code boxes
 *    (dominant) -> Confirm -> resend and "use a different email" as quiet text links.
 * Identical for everyone: it never says whether the address is on the learner list.
 */
async function Body({ searchParams }: { searchParams: PageProps<'/[tenant]/signup/confirm'>['searchParams'] }) {
  const next = safeNext((await searchParams).next)
  const a = await requireMember(`/signup/confirm?next=${encodeURIComponent(next)}`)
  const { data: m } = await a.db.from('tenant_members').select('email, email_verified_at').eq('id', a.memberId).single()
  if (m?.email_verified_at || !(await emailCodeRequired(a.db, a.bundle.tenant.id))) redirect(next === '/' ? '/dashboard' : next)
  const email = m?.email ?? ''
  return (
    <div className="auth-box">
      <div>
        <h1 className="t-title">Check your email</h1>
        <p className="t-lead" style={{ marginTop: 8 }}>We sent a 6-digit code to <b>{email}</b>. It works for 10 minutes.</p>
      </div>
      <ConfirmForm next={next} />
    </div>
  )
}

export default async function ConfirmPage(props: PageProps<'/[tenant]/signup/confirm'>) {
  const { brand, home } = await getShell()
  return (
    <AuthFrame brand={brand} learner={home?.authLearner}>
      <AuthTop brand={brand} />
      <Suspense fallback={<div className="auth-box" aria-busy />}><Body searchParams={props.searchParams} /></Suspense>
    </AuthFrame>
  )
}

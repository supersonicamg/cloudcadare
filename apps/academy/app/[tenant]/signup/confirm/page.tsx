import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { safeNext } from '@educore/core/accounts'
import { requireMember } from '@/lib/dal'
import { getShell } from '@/lib/shell'
import { h1s, lead } from '@/lib/ui'
import { ConfirmForm } from './confirm-form'

export const metadata = { title: 'Confirm your email' }

/*
 * A3 · Confirm email.
 * 1. One job: prove the learner owns this email address, before anything is granted.
 * 2. One main action: "Confirm email".
 * 3. Reading order: "Check your email" -> where the code went (one line, the address in ink) -> the code box
 *    (dominant: biggest element) -> Confirm -> resend as a quiet text link under a countdown.
 * Identical for everyone: it never says whether the address is on the learner list.
 */
async function Body({ searchParams }: { searchParams: PageProps<'/[tenant]/signup/confirm'>['searchParams'] }) {
  const next = safeNext((await searchParams).next)
  const a = await requireMember(`/signup/confirm?next=${encodeURIComponent(next)}`)
  const { data: m } = await a.db.from('tenant_members').select('email, email_verified_at').eq('id', a.memberId).single()
  if (m?.email_verified_at) redirect(next === '/' ? '/dashboard' : next)
  const email = m?.email ?? ''
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid gap-3">
        <h1 className={h1s}>Check your email</h1>
        <p className={lead}>We sent a 6-digit code to <b className="font-semibold text-fg">{email}</b>. It works for 10 minutes.</p>
      </div>
      <ConfirmForm next={next} />
    </div>
  )
}

export default async function ConfirmPage(props: PageProps<'/[tenant]/signup/confirm'>) {
  const { theme, brand, site } = await getShell()
  return (
    <theme.AuthLayout brand={brand} site={site}>
      <Suspense fallback={<div className="h-40" aria-busy />}><Body searchParams={props.searchParams} /></Suspense>
    </theme.AuthLayout>
  )
}

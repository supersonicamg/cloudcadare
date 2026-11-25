import { redirect } from 'next/navigation'
import { requireAccess } from '@/lib/dal'
import { safeAdminNext } from '@/lib/admin-next'
import { VerifyForm } from './verify-form'

export const metadata = { title: 'Confirm it is you' }

export default async function Mfa({ searchParams }: PageProps<'/[tenant]/admin/mfa'>) {
  const { next: rawNext } = await searchParams
  const next = safeAdminNext(Array.isArray(rawNext) ? rawNext[0] : rawNext)
  const a = await requireAccess({ permission: 'member.view' }, `/admin/mfa?next=${encodeURIComponent(next)}`)
  if (a.principal.aal === 'aal2') redirect(next)
  const { data } = await a.db.auth.mfa.listFactors()
  if (!data?.totp.length) redirect(`/admin/security?next=${encodeURIComponent(next)}`)

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Confirm it is you</h1>
      <p className="mt-2 mb-8 max-w-xl text-fg/70">This page changes money or access, so we need a code from your authenticator app first.</p>
      <VerifyForm next={next} />
    </>
  )
}

import { redirect } from 'next/navigation'
import { requireAccess } from '@/lib/dal'
import { safeAdminNext } from '@/lib/admin-next'
import { VerifyForm } from './verify-form'
import { Card, PageHeader } from '../_components/ui'

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
      <PageHeader title="Confirm it is you" lead="This page changes money or access. Open the authenticator app on your phone and enter its 6-digit code." />
      <Card><VerifyForm next={next} /></Card>
    </>
  )
}

import Link from 'next/link'
import { requireAccess } from '@/lib/dal'
import { safeAdminNext } from '@/lib/admin-next'
import { EnrolForm } from './enrol-form'
import { buttonSm } from '@/lib/ui'
import { Card, PageHeader } from '../_components/ui'

export const metadata = { title: 'My security' }

export default async function Security({ searchParams }: PageProps<'/[tenant]/admin/security'>) {
  const { next: rawNext } = await searchParams
  const next = safeAdminNext(Array.isArray(rawNext) ? rawNext[0] : rawNext)
  const a = await requireAccess({ permission: 'member.view' }, '/admin/security')
  const { data } = await a.db.auth.mfa.listFactors()
  const enrolled = (data?.totp.length ?? 0) > 0
  const verified = a.principal.aal === 'aal2'

  return (
    <>
      <PageHeader title="My security" lead="Changing prices or giving and removing course access needs a second check: a 6-digit code from an app on your phone." />
      <Card title="Code from your phone">
        {enrolled ? (
          <div className="grid max-w-xl justify-items-start gap-3">
            <p className="t-body !text-fg">The second check is <b>on</b> for your account.</p>
            <p className="t-body">{verified ? 'You have already entered your code this time.' : 'You will be asked for a code when you open one of those pages.'}</p>
            {!verified && <Link href={`/admin/mfa?next=${encodeURIComponent(next)}`} className={buttonSm}>Enter my code now</Link>}
          </div>
        ) : (
          <>
            {next !== '/admin' && <p className="mb-4 max-w-xl rounded-xl bg-tint-2 px-4 py-3 t-label !text-fg">The page you opened needs this. Set it up once, then you will go straight back.</p>}
            <EnrolForm next={next} />
          </>
        )}
      </Card>
    </>
  )
}

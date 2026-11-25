import Link from 'next/link'
import { requireAccess } from '@/lib/dal'
import { safeAdminNext } from '@/lib/admin-next'
import { EnrolForm } from './enrol-form'

export const metadata = { title: 'Security' }

export default async function Security({ searchParams }: PageProps<'/[tenant]/admin/security'>) {
  const { next: rawNext } = await searchParams
  const next = safeAdminNext(Array.isArray(rawNext) ? rawNext[0] : rawNext)
  const a = await requireAccess({ permission: 'member.view' }, '/admin/security')
  const { data } = await a.db.auth.mfa.listFactors()
  const enrolled = (data?.totp.length ?? 0) > 0
  const verified = a.principal.aal === 'aal2'

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
      <p className="mt-2 max-w-2xl text-fg/70">
        Some actions need a second check with an authenticator app: changing prices, connecting a payment account, granting or removing a learner&rsquo;s access and editing roles.
      </p>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Authenticator app</h2>
        {enrolled ? (
          <div className="max-w-xl space-y-3">
            <p>Two-step check is <span className="font-medium">on</span> for your account.</p>
            <p className="text-fg/70">{verified ? 'This sign-in is already verified.' : 'This sign-in is not verified yet. It will ask for a code when you open one of those pages.'}</p>
            {!verified && <Link href={`/admin/mfa?next=${encodeURIComponent(next)}`} className="inline-block text-primary underline">Verify now</Link>}
          </div>
        ) : (
          <>
            {next !== '/admin' && <p className="mb-4 max-w-xl rounded-[var(--radius)] bg-muted px-4 py-3 text-sm">The page you opened needs this. Set it up once, then you will go straight back.</p>}
            <EnrolForm next={next} />
          </>
        )}
      </section>
    </>
  )
}

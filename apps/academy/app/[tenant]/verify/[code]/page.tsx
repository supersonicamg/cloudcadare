import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCertificateByCode } from '@educore/core/catalog'
import { Icon } from '@educore/ui/marks'
import { getShell } from '@/lib/shell'
import { h1s } from '@/lib/ui'
import { CodeForm } from './code-form'

export const metadata: Metadata = { title: 'Verify a certificate', robots: { index: false, follow: false } }

/** Public: anyone with the code (printed on the certificate) can check it. */
export default async function Verify({ params }: PageProps<'/[tenant]/verify/[code]'>) {
  const { code } = await params
  const { bundle, theme, brand, nav, account, site } = await getShell()
  if (!/^[A-Za-z0-9]{12}$/.test(code)) notFound()
  const c = await getCertificateByCode(bundle.tenant.id, code.toUpperCase())

  const fmt = c && new Date(c.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const band = 'flex items-center gap-4 rounded-[18px] px-[22px] py-5 text-[22px] font-bold tracking-[-0.02em]'

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <section className="mx-auto max-w-[760px] px-5 pb-20 pt-8 md:pt-10">
        <h1 className={h1s}>Certificate check</h1>
        {!c ? (
          <div className="mt-6">
            <p className={`${band} bg-[#ECE8DD]`} data-testid="verify-result"><Icon name="info" className="h-[34px] w-[34px] shrink-0" />No certificate found for this code.</p>
            <p className="mt-6 text-[17px] text-grey">No certificate with this code was issued by {brand.name}. Check the code and try again.</p>
            <CodeForm />
          </div>
        ) : (
          <div className="mt-6">
            <p className={`${band} ${c.revoked ? 'bg-danger-bg text-danger-ink' : 'bg-ok-bg text-ok-ink'}`} data-testid="verify-result">
              <Icon name={c.revoked ? 'info' : 'shield'} className="h-[34px] w-[34px] shrink-0" strokeWidth={2.4} />{c.revoked ? 'This certificate has been revoked.' : 'This certificate is genuine.'}
            </p>
            <dl className="mt-7 grid gap-x-5 gap-y-0.5 border-t-2 border-fg pt-6 text-[17px] sm:grid-cols-[9rem_1fr] sm:gap-y-3">
              <dt className="text-mute">Awarded to</dt><dd className="mb-3 font-semibold sm:mb-0">{c.recipientName}</dd>
              <dt className="text-mute">For</dt><dd className="mb-3 font-semibold sm:mb-0">{c.title}</dd>
              <dt className="text-mute">Issued by</dt><dd className="mb-3 font-semibold sm:mb-0">{c.academy}</dd>
              <dt className="text-mute">Issued on</dt><dd className="mb-3 font-semibold sm:mb-0">{fmt}</dd>
              <dt className="text-mute">Number</dt><dd className="font-semibold">{c.serialNo}</dd>
            </dl>
          </div>
        )}
      </section>
    </theme.SiteLayout>
  )
}

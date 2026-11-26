import type { Metadata } from 'next'
import { getCertificateByCode } from '@educore/core/catalog'
import { getShell } from '@/lib/shell'
import { Ic, V11Frame } from '../../_components/v11'
import { SiteBar } from '../../_components/v11-bars'
import '../../account/account.css'
import { CodeForm } from './code-form'

export const metadata: Metadata = { title: 'Verify a certificate', robots: { index: false, follow: false } }

/** Public: anyone with the code (printed on the certificate) can check it. A plain facts page: the answer first, then the facts. */
export default async function Verify({ params }: PageProps<'/[tenant]/verify/[code]'>) {
  const { code } = await params
  const { bundle, brand } = await getShell()
  // A mistyped code is a normal case here: answer "not found" with the form, not a 404.
  const valid = /^[A-Za-z0-9]{12}$/.test(code)
  const c = valid ? await getCertificateByCode(bundle.tenant.id, code.toUpperCase()) : null
  const fmt = c && new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(c.issuedAt))

  return (
    <V11Frame shell="site" header={<SiteBar brand={brand} />}>
      <div className="vpg">
        <h1 className="t-title">Certificate check</h1>
        {valid && <p className="t-lead" style={{ marginTop: 8 }}>Code <b className="tnum">{code.toUpperCase()}</b></p>}

        {!c ? (
          <div className="vres no">
            <span className="ti lg"><Ic n="info" /></span>
            <div>
              <p className="t-h3" data-testid="verify-result">No certificate has this code.</p>
              <p className="t-small">Check each letter and number, then try again.</p>
            </div>
          </div>
        ) : (
          <>
            <div className={`vres${c.revoked ? ' no' : ''}`}>
              <span className={`ti lg${c.revoked ? '' : ' done'}`}><Ic n={c.revoked ? 'info' : 'shield'} /></span>
              <p className="t-h3" data-testid="verify-result">{c.revoked ? 'This certificate was withdrawn.' : 'This certificate is genuine.'}</p>
            </div>
            <dl className="facts">
              <div><dt>Awarded to</dt><dd>{c.recipientName}</dd><span /></div>
              <div><dt>For</dt><dd>{c.title}</dd><span /></div>
              <div><dt>Issued by</dt><dd>{c.academy}</dd><span /></div>
              <div><dt>Issued on</dt><dd>{fmt}</dd><span /></div>
              <div><dt>Number</dt><dd className="tnum">{c.serialNo}</dd><span /></div>
            </dl>
          </>
        )}

        <CodeForm />
      </div>
    </V11Frame>
  )
}

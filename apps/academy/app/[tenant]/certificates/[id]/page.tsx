import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/lib/dal'
import { getShell } from '@/lib/shell'
import { tenantOrigin } from '@/lib/outbox'
import { Ic, V11Frame } from '../../_components/v11'
import { BrandMark } from '../../account/ui'
import '../../account/account.css'
import { PrintButton } from '../../orders/[id]/print-button'

export const metadata: Metadata = { title: 'Certificate' }

const long = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

/** The certificate itself, drawn in code. No site chrome, so printing or "save as PDF" gives just the page. */
export default async function Certificate({ params }: PageProps<'/[tenant]/certificates/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const a = await requireMember(`/certificates/${id}`)
  const { brand, bundle } = await getShell()
  const { data: c } = await a.db.from('certificates').select('recipient_name, title, serial_no, verification_code, issued_at, revoked_at, enrollment_id').eq('id', id).eq('member_id', a.memberId).maybeSingle()
  if (!c) notFound()
  // The batch the learner took it in, when the certificate still points at that enrolment.
  const { data: enr } = c.enrollment_id ? await a.db.from('enrollments').select('batches(name)').eq('id', c.enrollment_id).maybeSingle() : { data: null }
  const batch = enr ? (Array.isArray(enr.batches) ? enr.batches[0] : enr.batches)?.name : null
  const verifyUrl = `${tenantOrigin(bundle.tenant.slug)}/verify/${c.verification_code}`.replace(/^https?:\/\//, '')

  return (
    <V11Frame shell="none">
      <div className="cert-pg">
        <div className="cert-bar noprint">
          <Link className="fback" href="/certificates"><Ic n="back" />My certificates</Link>
          <PrintButton label="Download PDF" icon="down" className="btn btn-sm" />
        </div>
        <div className="cert">
          <article aria-label="Certificate">
            <div className="cert-in">
              <span className="logo"><BrandMark brand={brand} width={32} />{brand.name}</span>
              <h1 className="t-h2">Certificate of completion</h1>
              <p className="t-small" style={{ marginTop: 28 }}>This certifies that</p>
              <p className="nm" data-testid="cert-name">{c.recipient_name}</p>
              <span className="rl" aria-hidden="true" />
              <p className="t-small" style={{ marginTop: 24 }}>has completed</p>
              <p className="t-h3" style={{ marginTop: 6 }} data-testid="cert-title">{c.title}</p>
              <div className="facts2">
                <div><span className="t-label">Issued</span><b>{long(c.issued_at)}</b></div>
                <div><span className="t-label">Certificate no.</span><b className="tnum">{c.serial_no}</b></div>
                {batch && <div><span className="t-label">Batch</span><b>{batch}</b></div>}
              </div>
              <p className="t-label vr">Check it at {verifyUrl}</p>
              {c.revoked_at && <p role="alert" className="note-l" style={{ marginTop: 24 }}><Ic n="info" s /><span>This certificate was withdrawn.</span></p>}
            </div>
          </article>
        </div>
      </div>
    </V11Frame>
  )
}

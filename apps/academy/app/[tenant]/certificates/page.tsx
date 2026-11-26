import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { dateLong } from '@/lib/format'
import { getMyEnrollments } from '@/lib/learn'
import { tenantOrigin } from '@/lib/outbox'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../_components/learner-shell'
import { Ic } from '../_components/v11'
import { BrandMark, CertMini, St } from '../account/ui'
import '../account/account.css'
import { CopyLink } from './copy-link'

export const metadata = { title: 'My certificates' }

/*
 * My certificates. After earning: one row per certificate with a small picture of it, "View and download" (outline) and
 * the check link. Before: what is left, as rows with real counts, and a preview of how the name will print.
 * What is left is what the database asks for to issue one: every required lesson of the course done (completion
 * threshold), plus the name to print. Tests are not a separate condition today, so none is listed.
 */
export default async function MyCertificates() {
  const a = await requireMember('/certificates')
  const shell = await getShell()
  const { bundle, brand } = shell
  if (!isEnabled(bundle.features, 'learning.certificates')) notFound()
  const [{ data }, enrollments, member] = await Promise.all([
    a.db.from('certificates').select('id, title, serial_no, issued_at, revoked_at, verification_code, recipient_name').eq('member_id', a.memberId).order('issued_at', { ascending: false }),
    getMyEnrollments(a),
    a.db.from('tenant_members').select('display_name, custom_fields').eq('id', a.memberId).maybeSingle(),
  ])
  const have = data ?? []
  const lead = enrollments.find((e) => e.status === 'active') ?? enrollments[0]
  const { data: courseRow } = have.length === 0 && lead ? await a.db.from('courses').select('settings').eq('id', lead.course.id).maybeSingle() : { data: null }
  const offered = ((courseRow?.settings ?? {}) as { certificate?: unknown }).certificate !== 'false'
  const printName = ((member.data?.custom_fields ?? {}) as { certificate_name?: string }).certificate_name || member.data?.display_name || a.memberName

  return (
    <LearnerShell a={a} shell={shell} active={null}>
      <div className="pg">
        <div className="pg-h"><div>
          <h1 className="t-title">My certificates</h1>
          <p className="t-lead">
            {have.length > 0 ? 'Anyone can check your certificate with its code.'
              : lead && offered ? <>You get your certificate when you finish <b>{lead.course.title}</b>.</>
              : 'You will get a certificate here when you finish a course that offers one.'}
          </p>
        </div></div>

        {have.length > 0 ? (
          <ul className="rows">
            {have.map((c) => (
              <li key={c.id} className="certl">
                <div className="certmini" aria-hidden="true" style={{ padding: 8 }}>
                  <div style={{ padding: '14px 6px', gap: 6 }}>
                    <BrandMark brand={brand} width={18} />
                    <span className="t-label" style={{ fontWeight: 600, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{c.recipient_name}</span>
                  </div>
                </div>
                <div className="tx">
                  <b className="t-card">{c.title}</b>
                  <span className="t-small">No. {c.serial_no} · issued {dateLong(c.issued_at)}{c.revoked_at && <> · <St tone="quiet">Withdrawn</St></>}</span>
                  <span className="t-label">Check code <span className="tnum">{c.verification_code}</span></span>
                </div>
                <div className="acts2">
                  <Link className="btn btn-line btn-sm" href={`/certificates/${c.id}`}>View and download</Link>
                  <CopyLink url={`${tenantOrigin(bundle.tenant.slug)}/verify/${c.verification_code}`} />
                </div>
              </li>
            ))}
          </ul>
        ) : lead && offered ? (
          <div className="req">
            <section aria-labelledby="rq-h">
              <div className="blk-h"><h2 className="t-h3" id="rq-h">What is left</h2></div>
              <ul className="rows">
                <li>
                  <div className="row">
                    <span className={`ti${lead.lessonsTotal > 0 && lead.lessonsCompleted >= lead.lessonsTotal ? ' done' : ''}`}><Ic n={lead.lessonsTotal > 0 && lead.lessonsCompleted >= lead.lessonsTotal ? 'check' : 'book'} /></span>
                    <span className="tx"><b>Finish every lesson</b><span>Videos, readings, PDFs, labs and recordings</span></span>
                    <span className="rt"><b className="tnum">{lead.lessonsCompleted} of {lead.lessonsTotal}</b><span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, lead.progressPct))}%` }} /></span></span>
                  </div>
                </li>
                <li>
                  <Link className="row" href="/account">
                    <span className="ti done"><Ic n="check" /></span>
                    <span className="tx"><b>Confirm the name to print</b><span>{printName}</span></span>
                    <span className="rt"><span className="link link-s" style={{ minHeight: 0 }}>Change</span></span>
                  </Link>
                </li>
              </ul>
            </section>
            <figure>
              <CertMini dim mark={<BrandMark brand={brand} />} name={printName} program={lead.course.title} />
              <figcaption className="t-label" style={{ marginTop: 10 }}>This is how yours will look.</figcaption>
            </figure>
          </div>
        ) : null}
      </div>
    </LearnerShell>
  )
}

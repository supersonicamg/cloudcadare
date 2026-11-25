import { requireAccess } from '@/lib/dal'
import { inputSm } from '@/lib/ui'
import { Empty, PageHeader } from '../_components/ui'
import { ConfirmButton } from '../_components/confirm'
import { revokeCertificate } from './actions'

export const metadata = { title: 'Certificates' }

export default async function Certificates() {
  const a = await requireAccess({ permission: 'certificate.manage', feature: 'learning.certificates' }, '/admin/certificates')
  const { data } = await a.db.from('certificates').select('id, recipient_name, title, serial_no, verification_code, issued_at, revoked_at, revoke_reason')
    .order('issued_at', { ascending: false }).limit(200)
  return (
    <>
      <PageHeader title="Certificates" lead="Students get one automatically when they finish a course. You can switch this off in a course’s details." />
      {data?.length ? (
        <ul className="divide-y divide-border rounded-[20px] bg-white px-5 ring-1 ring-border">
          {data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
              <div className="min-w-0 flex-1 basis-60">
                <p className="t-card !text-[17px]">{c.recipient_name}</p>
                <p className="t-small">{c.title} · given {new Date(c.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <p className="break-all t-small">Number {c.serial_no} · check code {c.verification_code}</p>
                {c.revoked_at && <p className="t-small !text-danger-ink">Cancelled{c.revoke_reason ? `: ${c.revoke_reason}` : ''}</p>}
              </div>
              {!c.revoked_at && (
                <ConfirmButton action={revokeCertificate.bind(null, c.id)} label="Cancel certificate" name={`Cancel certificate ${c.serial_no}`} yes="Yes, cancel it"
                  question={`Cancel ${c.recipient_name}’s certificate? Anyone checking it will see that it is not valid. This cannot be undone here.`}>
                  <input name="reason" aria-label={`Reason for cancelling ${c.serial_no}`} placeholder="Reason (shown on the check page)" maxLength={300} className={`${inputSm} max-w-md`} />
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      ) : <Empty icon="medal" title="No certificates yet">They appear here when students finish a course.</Empty>}
    </>
  )
}

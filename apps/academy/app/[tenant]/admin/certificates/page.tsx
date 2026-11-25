import { requireAccess } from '@/lib/dal'
import { buttonQuiet, input } from '@/lib/ui'
import { revokeCertificate } from './actions'

export const metadata = { title: 'Certificates' }

export default async function Certificates() {
  const a = await requireAccess({ permission: 'certificate.manage', feature: 'learning.certificates' }, '/admin/certificates')
  const { data } = await a.db.from('certificates').select('id, recipient_name, title, serial_no, verification_code, issued_at, revoked_at, revoke_reason')
    .order('issued_at', { ascending: false }).limit(200)
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Certificates</h1>
      <p className="mt-2 max-w-2xl text-fg/70">Issued automatically when a learner completes a course. Turn it off for a course on its edit page. Revoking a certificate makes its public check page say so.</p>
      {data?.length ? (
        <ul className="mt-8 border-t border-border">
          {data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-border py-3">
              <div>
                <p className="font-medium">{c.recipient_name} <span className="font-normal text-fg/65">{c.title}</span></p>
                <p className="text-sm text-fg/65">{c.serial_no} · code {c.verification_code} · {new Date(c.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{c.revoked_at ? ` · revoked${c.revoke_reason ? `: ${c.revoke_reason}` : ''}` : ''}</p>
              </div>
              {!c.revoked_at && (
                <form action={revokeCertificate.bind(null, c.id)} className="flex items-center gap-2">
                  <input name="reason" aria-label={`Reason to revoke ${c.serial_no}`} placeholder="Reason" maxLength={300} className={`${input} w-48`} />
                  <button className={buttonQuiet}>Revoke</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="mt-8 text-fg/70">No certificates have been issued yet.</p>}
    </>
  )
}

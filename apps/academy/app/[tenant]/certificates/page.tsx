import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../_components/learner-shell'
import { buttonQuiet, chipClass, h1s } from '@/lib/ui'

export const metadata = { title: 'My certificates' }

export default async function MyCertificates() {
  const a = await requireMember('/certificates')
  const shell = await getShell()
  const { bundle } = shell
  if (!isEnabled(bundle.features, 'learning.certificates')) notFound()
  const { data } = await a.db.from('certificates').select('id, title, serial_no, issued_at, revoked_at').eq('member_id', a.memberId).order('issued_at', { ascending: false })
  return (
    <LearnerShell a={a} shell={shell} active={null}>
      <section>
        <h1 className={h1s}>My certificates</h1>
        {data?.length ? (
          <ul className="mt-[26px] border-t-2 border-fg">
            {data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border py-5">
                <div className="flex items-center gap-4">
                  <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-tint-2"><Icon name="medal" className="h-6 w-6" /></span>
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.02em]">{c.title}</p>
                    <p className="mt-0.5 text-[15px] text-mute">{c.serial_no} · issued {new Date(c.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{c.revoked_at ? <> · <span className={chipClass('bad')}>Revoked</span></> : ''}</p>
                  </div>
                </div>
                <Link href={`/certificates/${c.id}`} className={buttonQuiet}>View</Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-6 max-w-lg text-[17px] text-grey">You will get a certificate here when you finish a course that offers one.</p>}
      </section>
    </LearnerShell>
  )
}

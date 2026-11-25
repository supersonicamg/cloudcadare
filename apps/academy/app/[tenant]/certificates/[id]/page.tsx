import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { getShell } from '@/lib/shell'
import { PrintButton } from '../../orders/[id]/print-button'
import { tenantOrigin } from '@/lib/outbox'
import { backLink, bannerClass } from '@/lib/ui'

export const metadata: Metadata = { title: 'Certificate' }

/** The certificate itself. No site chrome, so printing or "save as PDF" gives just the page. */
export default async function Certificate({ params }: PageProps<'/[tenant]/certificates/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const a = await requireMember(`/certificates/${id}`)
  const { brand, bundle } = await getShell()
  const { data: c } = await a.db.from('certificates').select('recipient_name, title, serial_no, verification_code, issued_at, revoked_at').eq('id', id).eq('member_id', a.memberId).maybeSingle()
  if (!c) notFound()
  const verifyUrl = `${tenantOrigin(bundle.tenant.slug)}/verify/${c.verification_code}`

  return (
    <main className="min-h-dvh bg-[#EFEBE0] print:bg-white">
      <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-[22px] print:hidden">
        <Link href="/certificates" className={backLink}><Icon name="back" className="h-5 w-5" />My certificates</Link>
        <PrintButton />
      </div>
      <div className="px-5 pb-16 print:p-0">
        <article aria-label="Certificate" className="mx-auto max-w-[1040px] rounded-md bg-white p-3.5 shadow-[0_1px_0_var(--color-border)] print:shadow-none">
          <div className="flex flex-col items-center border-[3px] border-primary px-6 pb-9 pt-10 text-center outline outline-[1.5px] -outline-offset-[11px] outline-primary md:px-24 md:pb-16 md:pt-20">
            <span className="grid h-[108px] w-[92px] place-items-center rounded-[50%_50%_14px_14px/40%_40%_14px_14px] bg-primary text-primary-fg">
              <Icon name="medal" className="h-12 w-12" />
            </span>
            <p className="mt-[18px] font-heading text-[22px] font-bold tracking-[-0.03em]">{brand.name}</p>
            <h1 className="mt-[34px] font-heading text-[clamp(34px,5vw,64px)] font-extrabold leading-none tracking-[-0.045em] text-balance">Certificate of completion</h1>
            <p className="mt-[34px] text-[17px] text-grey">This certifies that</p>
            <p className="mt-2 bg-[linear-gradient(transparent_70%,var(--color-accent)_70%_92%,transparent_92%)] pb-1.5 font-heading text-[clamp(34px,5vw,60px)] font-extrabold tracking-[-0.045em]" data-testid="cert-name">{c.recipient_name}</p>
            <p className="mt-[34px] text-[17px] text-grey">has successfully completed</p>
            <p className="mt-2 font-heading text-[clamp(22px,2.8vw,32px)] font-bold tracking-[-0.03em] text-primary" data-testid="cert-title">{c.title}</p>
            <p className="mt-11 grid gap-x-10 gap-y-1.5 text-[15px] text-grey sm:grid-cols-2">
              <span>Issued <b className="font-semibold text-fg">{new Date(c.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b></span>
              <span>Certificate no. <b className="font-semibold text-fg">{c.serial_no}</b></span>
            </p>
            <p className="mt-7 break-all border-t border-border pt-[18px] text-sm text-mute">Verify at {verifyUrl}</p>
            {c.revoked_at && <p role="alert" className={`${bannerClass('bad')} mt-6`}>This certificate has been revoked.</p>}
          </div>
        </article>
      </div>
    </main>
  )
}

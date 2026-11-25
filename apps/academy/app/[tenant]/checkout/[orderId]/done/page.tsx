import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { dateLong } from '@/lib/format'
import { money } from '@/lib/money'
import { getShell } from '@/lib/shell'
import { buttonLg, h1s, lead } from '@/lib/ui'

export const metadata = { title: 'Payment verified' }

/*
 * A7 · Payment verified.
 * 1. One job: confirm the course is unlocked, in the first words.
 * 2. One main action: "Start learning". The receipt is a quiet text link.
 * 3. Reading order: yellow tick (the one yellow thing) -> "Payment verified. {course} is unlocked." -> three facts
 *    (amount, order number, access until) -> Start learning -> receipt link.
 */
export default async function Done({ params }: PageProps<'/[tenant]/checkout/[orderId]/done'>) {
  const { orderId } = await params
  if (!z.uuid().safeParse(orderId).success) notFound()
  const a = await requireMember(`/checkout/${orderId}/done`)
  const [{ theme, brand }, order, items, enr] = await Promise.all([
    getShell(),
    a.db.from('orders').select('order_no, status, total_minor, currency, paid_at').eq('id', orderId).eq('member_id', a.memberId).maybeSingle(),
    a.db.from('order_items').select('id, title_snapshot').eq('order_id', orderId),
    a.db.from('enrollments').select('expires_at, courses(slug)').eq('member_id', a.memberId).eq('source', 'purchase').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (!order.data) notFound()
  const o = order.data
  if (o.status !== 'paid') redirect(`/checkout/${orderId}/pending`)
  const title = items.data?.map((i) => i.title_snapshot).join(', ') ?? 'Your course'
  const course = Array.isArray(enr.data?.courses) ? enr.data?.courses[0] : enr.data?.courses

  return (
    <theme.FocusLayout brand={brand} bar={{ title: 'Payment', exit: { label: 'Close', href: '/account/payments' } }}>
      <section aria-labelledby="ok-h" className="mx-auto flex max-w-[640px] flex-col items-start gap-6 px-[clamp(16px,5vw,32px)] pb-24 pt-12 md:pt-20">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-fg"><Icon name="check" className="h-8 w-8" /></span>
        <div className="grid gap-3">
          <h1 id="ok-h" className={h1s}>Payment verified. <span className="text-primary">{title}</span> is unlocked.</h1>
          <p className={lead}>We sent your receipt to your email.</p>
        </div>
        <ul className="t-label flex flex-wrap gap-x-8 gap-y-2 !text-fg">
          <li className="flex items-center gap-2 tnum"><Icon name="check" className="h-5 w-5 text-primary" />{money(o.total_minor, o.currency)} paid</li>
          <li className="flex items-center gap-2 tnum"><Icon name="doc" className="h-5 w-5 text-primary" />Order {o.order_no}</li>
          <li className="flex items-center gap-2"><Icon name="clock" className="h-5 w-5 text-primary" />{enr.data?.expires_at ? `Access until ${dateLong(enr.data.expires_at)}` : 'No end date'}</li>
        </ul>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href={course?.slug ? `/learn/${course.slug}` : '/dashboard'} className={`${buttonLg} w-full sm:w-auto`}>Start learning <span aria-hidden="true">→</span></Link>
          <Link href={`/orders/${orderId}`} className="inline-flex min-h-11 items-center t-btn-sm !font-bold text-primary underline underline-offset-4">See your receipt</Link>
        </div>
      </section>
    </theme.FocusLayout>
  )
}

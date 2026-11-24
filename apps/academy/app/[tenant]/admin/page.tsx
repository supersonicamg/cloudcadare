import Link from 'next/link'
import { isEnabled } from '@educore/features'
import { can, holds, requireAccess } from '@/lib/dal'
import { money } from '@/lib/money'
import { buttonQuiet, buttonSm, pageHead, pageTitle, statRow } from '@/lib/ui'

export const metadata = { title: 'Overview' }

const DAY = 86_400_000

export default async function AdminHome() {
  const a = await requireAccess({ permission: 'member.view' }, '/admin')
  const f = a.bundle.features
  const hasCourses = isEnabled(f, 'catalog.courses')
  const sells = isEnabled(f, 'commerce.checkout') && can(a, 'order.view')

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString()
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString()

  const [courses, published, members, learners, week, month, account] = await Promise.all([
    a.db.from('courses').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    a.db.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
    a.db.from('tenant_members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    a.db.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    sells ? a.db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid').gte('paid_at', weekAgo) : null,
    sells ? a.db.from('orders').select('total_minor').eq('status', 'paid').gte('paid_at', monthStart).limit(5000) : null,
    sells ? a.db.from('payment_gateway_accounts').select('mode').eq('is_active', true).eq('is_default', true).maybeSingle() : null,
  ])

  const stats = [
    hasCourses && { label: 'Courses', value: String(courses.count ?? 0), note: `${published.count ?? 0} published` },
    { label: 'Active members', value: String(members.count ?? 0), note: `${learners.count ?? 0} enrolments` },
    sells && { label: 'Orders this week', value: String(week?.count ?? 0), note: 'paid, last 7 days' },
    sells && { label: 'Revenue this month', value: money((month?.data ?? []).reduce((s, o) => s + o.total_minor, 0)), note: 'paid orders' },
  ].filter(Boolean) as { label: string; value: string; note: string }[]

  // Steps appear only for modules this academy has, and tick themselves off.
  const steps = [
    hasCourses && can(a, 'course.manage') && { title: 'Add your first course', text: 'Start with a draft. Nothing is public until you publish it.', done: (published.count ?? 0) > 0, href: '/admin/courses', cta: 'Add a course' },
    sells && holds(a, 'price.manage') && { title: 'Connect Razorpay', text: 'So learners can pay. Test mode uses no real money.', done: Boolean(account?.data), href: '/admin/payments', cta: 'Open payments' },
    can(a, 'tenant.branding.manage') && { title: 'Set your name and colours', text: 'Your site updates within a moment.', done: Boolean(a.bundle.branding.tagline), href: '/admin/branding', cta: 'Open branding' },
  ].filter(Boolean) as { title: string; text: string; done: boolean; href: string; cta: string }[]
  const open = steps.filter((s) => !s.done)

  return (
    <>
      <div className={pageHead}>
        <div>
          <h1 className={pageTitle}>Overview</h1>
          <p className="mt-1.5 text-base text-mute">{a.bundle.branding.displayName} · {new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' }).format(now)}</p>
        </div>
      </div>

      <dl className={`${statRow} grid-cols-2 gap-x-6 lg:grid-cols-4 lg:gap-x-0`}>
        {stats.map((s) => (
          <div key={s.label} className="border-fg/15 py-5 lg:border-l lg:pl-5 lg:first:border-l-0 lg:first:pl-0">
            <dd className="font-heading text-[34px] font-extrabold leading-none tracking-tight">{s.value}</dd>
            <dt className="mt-2 text-[15px] font-semibold">{s.label}</dt>
            <dd className="text-sm text-mute">{s.note}</dd>
          </div>
        ))}
      </dl>

      {open.length > 0 && (
        <section className="mt-12" aria-labelledby="start">
          <h2 id="start" className="font-heading text-2xl font-bold tracking-tight">Get started</h2>
          <p className="mt-1 text-base text-mute">{open.length === 1 ? 'One step left' : `${open.length} steps left`} before your first learner can buy.</p>
          <ol className="mt-5 border-t-2 border-fg">
            {steps.map((s, i) => (
              <li key={s.title} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border py-4">
                <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full border-2 text-[15px] font-bold ${s.done ? 'border-primary bg-primary text-primary-fg' : 'border-fg'}`}>
                  {s.done ? <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> : i + 1}
                </span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-[17px] font-bold leading-snug">{s.title}{s.done && <span className="sr-only"> (done)</span>}</p>
                  <p className="text-[15px] text-mute">{s.done ? 'Done' : s.text}</p>
                </div>
                {!s.done && <Link href={s.href} className={buttonSm}>{s.cta}</Link>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {open.length === 0 && hasCourses && can(a, 'course.manage') && (
        <p className="mt-10"><Link className={buttonQuiet} href="/admin/courses">Add or edit courses</Link></p>
      )}
    </>
  )
}

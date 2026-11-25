import Link from 'next/link'
import { isEnabled } from '@educore/features'
import { can, holds, requireAccess } from '@/lib/dal'
import { money } from '@/lib/money'
import { PageHeader, Task, Card } from './_components/ui'
import { canTeach, paymentPages, studentPages, waitingPayments } from './_components/sections'

export const metadata = { title: 'Home' }

export default async function AdminHome() {
  const a = await requireAccess({ permission: 'member.view' }, '/admin')
  const f = a.bundle.features
  const teaches = canTeach(a)
  const students = studentPages(a)
  const sells = isEnabled(f, 'commerce.checkout') && can(a, 'order.view')
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()

  const [waiting, enrolled, month, empty, courses, account] = await Promise.all([
    waitingPayments(a),
    students.length ? a.db.from('enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active') : null,
    sells ? a.db.from('orders').select('total_minor').eq('status', 'paid').gte('paid_at', monthStart).limit(5000) : null,
    // Video lessons with nothing to play yet.
    teaches ? a.db.from('lessons').select('id, title, course_id, courses!inner(status, deleted_at)', { count: 'exact' }).in('type', ['video', 'live'])
      .is('media_asset_id', null).is('external_url', null).is('deleted_at', null).neq('courses.status', 'archived').is('courses.deleted_at', null)
      .order('created_at', { ascending: false }).limit(5) : null,
    teaches ? a.db.from('courses').select('id, status').is('deleted_at', null).neq('status', 'archived').order('updated_at', { ascending: false }).limit(20) : null,
    sells && holds(a, 'price.manage') ? a.db.from('payment_gateway_accounts').select('mode').eq('is_active', true).eq('is_default', true).maybeSingle() : null,
  ])

  const list = courses?.data ?? []
  // With one program (CloudCadre today), "add videos" goes straight to it.
  const uploadHref = list.length === 1 ? `/admin/courses/${list[0]!.id}` : '/admin/courses'
  const payments = paymentPages(a, waiting)
  const stats = [
    enrolled && { label: 'Students with access', value: String(enrolled.count ?? 0) },
    month && { label: 'Money received this month', value: money((month.data ?? []).reduce((s, o) => s + o.total_minor, 0)) },
    payments.length > 0 && { label: 'Payments to check', value: String(waiting) },
  ].filter(Boolean) as { label: string; value: string }[]

  const todo = [
    teaches && can(a, 'course.manage') && !list.some((c) => c.status === 'published') && { text: 'Publish your course so people can see it.', href: uploadHref, cta: 'Open course' },
    account && !account.data && { text: 'Card and net banking payments are not set up (UPI is separate).', href: '/admin/payments', cta: 'Set up payments' },
    can(a, 'tenant.branding.manage') && !a.bundle.branding.tagline && { text: 'Add a one-line description of your academy.', href: '/admin/branding', cta: 'Website look' },
  ].filter(Boolean) as { text: string; href: string; cta: string }[]

  return (
    <>
      <PageHeader title={`Hello, ${a.memberName.split(' ')[0]}`} lead="What do you want to do?" />

      <div className="grid gap-4 sm:grid-cols-2">
        {teaches && <Task href={uploadHref} icon="video" title="Upload class videos" text="Add recordings and lessons for your students." />}
        {students.length > 0 && <Task href={students[0]!.href} icon="user" title="Give a student access" text="Open a course for someone, or see who has it." />}
        {payments.length > 0 && <Task href={payments[0]!.href} icon="check" title="Check payments" text={waiting ? `${waiting} ${waiting === 1 ? 'student is' : 'students are'} waiting for approval.` : 'No payment is waiting.'} badge={waiting || undefined} />}
        {can(a, 'tenant.branding.manage') && <Task href="/admin/branding" icon="image" title="Change the website look" text="Academy name, short description and colours." />}
      </div>

      {stats.length > 0 && (
        <dl className="mt-6 grid gap-px overflow-hidden rounded-[20px] bg-border ring-1 ring-border sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse bg-white p-5">
              <dt className="mt-2 t-label">{s.label}</dt>
              <dd className="t-num">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {empty?.data?.length ? (
        <Card className="mt-6" title={`${empty.count} ${empty.count === 1 ? 'lesson has' : 'lessons have'} no video`} lead="Students see “not ready” until you add one.">
          <ul className="divide-y divide-border">
            {empty.data.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 t-label !text-fg">{l.title}</span>
                <Link href={`/admin/courses/${l.course_id}/lessons/${l.id}`} className="inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4">Add video</Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {todo.length > 0 && (
        <Card className="mt-6" title="Finish setting up">
          <ul className="divide-y divide-border">
            {todo.map((t) => (
              <li key={t.text} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0 t-body !text-fg">{t.text}</span>
                <Link href={t.href} className="inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4">{t.cta}</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}

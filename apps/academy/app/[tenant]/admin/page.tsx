import Link from 'next/link'
import { isEnabled } from '@educore/features'
import { can, requireAccess } from '@/lib/dal'

export default async function AdminHome() {
  const a = await requireAccess({ permission: 'member.view' }, '/admin')
  const [courses, published, members] = await Promise.all([
    a.db.from('courses').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    a.db.from('courses').select('id', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
    a.db.from('tenant_members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ])
  const stats = [
    isEnabled(a.bundle.features, 'catalog.courses') && { label: 'Courses', value: courses.count ?? 0, note: `${published.count ?? 0} published` },
    { label: 'Members', value: members.count ?? 0, note: 'active' },
  ].filter(Boolean) as { label: string; value: number; note: string }[]
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
      <dl className="mt-8 grid max-w-md grid-cols-2 gap-8">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-fg/65">{s.label}</dt>
            <dd className="mt-1 text-4xl font-semibold">{s.value}</dd>
            <dd className="text-sm text-fg/60">{s.note}</dd>
          </div>
        ))}
      </dl>
      {can(a, 'course.manage') && isEnabled(a.bundle.features, 'catalog.courses') && (
        <p className="mt-10"><Link className="text-primary underline" href="/admin/courses">Add or edit courses</Link></p>
      )}
    </>
  )
}

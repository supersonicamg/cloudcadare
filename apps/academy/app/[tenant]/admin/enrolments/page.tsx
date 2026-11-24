import { requireAccess } from '@/lib/dal'
import { buttonQuiet, pageTitle, sectionTitle } from '@/lib/ui'
import { revokeAccess } from './actions'
import { GrantForm } from './grant-form'

export const metadata = { title: 'Enrolments' }

const SOURCE: Record<string, string> = { purchase: 'Purchase', admin: 'Given by staff', free: 'Free signup', bundle: 'Bundle', subscription: 'Subscription', import: 'Import', coupon: 'Coupon', trial: 'Trial' }

export default async function Enrolments() {
  const a = await requireAccess({ permission: 'enrollment.manage', feature: 'catalog.courses' }, '/admin/enrolments')
  const [courses, rows] = await Promise.all([
    a.db.from('courses').select('id, title').is('deleted_at', null).order('title'),
    a.db.from('enrollments')
      .select('id, status, source, progress_pct, started_at, expires_at, tenant_members(display_name, email), courses(title)')
      .in('status', ['active', 'paused', 'completed']).order('started_at', { ascending: false }).limit(100),
  ])
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null

  return (
    <>
      <h1 className={pageTitle}>Enrolments</h1>
      <section className="mt-8">
        <h2 className={sectionTitle + " mb-4"}>Give someone access</h2>
        {courses.data?.length ? <GrantForm courses={courses.data} /> : <p className="text-grey">Create a course first.</p>}
      </section>

      <section className="mt-14">
        <h2 className={sectionTitle + " mb-2"}>Who has access</h2>
        {rows.data?.length ? (
          <ul className="border-t border-border">
            {rows.data.map((e) => {
              const m = one(e.tenant_members), c = one(e.courses)
              return (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border py-3">
                  <div>
                    <p className="font-medium">{m?.display_name} <span className="font-normal text-mute">{m?.email}</span></p>
                    <p className="text-sm text-mute">
                      {c?.title} · {e.status === 'completed' ? 'Completed' : `${Math.round(Number(e.progress_pct))}%`} · {SOURCE[e.source] ?? e.source}
                    </p>
                  </div>
                  <form action={revokeAccess.bind(null, e.id)}><button className={buttonQuiet}>Remove access</button></form>
                </li>
              )
            })}
          </ul>
        ) : <p className="text-grey">No one is enrolled yet.</p>}
      </section>
    </>
  )
}

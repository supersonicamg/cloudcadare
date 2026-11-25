import Link from 'next/link'
import { requireAccess } from '@/lib/dal'
import { dateShort } from '@/lib/format'
import { buttonOutline, inputSm } from '@/lib/ui'
import { Card, Empty, PageHeader, Tabs } from '../_components/ui'
import { ConfirmButton } from '../_components/confirm'
import { studentPages } from '../_components/sections'
import { revokeAccess } from './actions'
import { GrantForm } from './grant-form'

export const metadata = { title: 'Students' }

const SOURCE: Record<string, string> = { purchase: 'Paid', admin: 'Given by your team', free: 'Joined free', bundle: 'Bundle', subscription: 'Subscription', import: 'Imported', coupon: 'Discount code', trial: 'Trial' }
const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null

export default async function Enrolments({ searchParams }: PageProps<'/[tenant]/admin/enrolments'>) {
  const sp = await searchParams
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80).replace(/[%,()*\\]/g, '')
  const a = await requireAccess({ permission: 'enrollment.manage', feature: 'catalog.courses' }, '/admin/enrolments')

  let query = a.db.from('enrollments')
    .select(`id, status, source, progress_pct, started_at, tenant_members${q ? '!inner' : ''}(display_name, email), courses(title)`)
    .in('status', ['active', 'paused', 'completed']).order('started_at', { ascending: false }).limit(100)
  if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`, { referencedTable: 'tenant_members' })
  const [courses, rows] = await Promise.all([
    a.db.from('courses').select('id, title').is('deleted_at', null).neq('status', 'archived').order('title'),
    query,
  ])

  return (
    <>
      <PageHeader title="Students" lead="Open a course for a student, or take access away." />
      <Tabs label="Students" current="/admin/enrolments" items={studentPages(a)} />

      <div className="grid gap-5">
        <Card title="Give a student access" lead="For someone who has already signed up on your website.">
          {courses.data?.length ? <GrantForm courses={courses.data} /> : <p className="t-body">Create a course first.</p>}
          <p className="mt-3 t-label">Not signed up yet? <Link href="/admin/learner-list" className="!text-primary underline underline-offset-4">Approve their email in advance</Link>.</p>
        </Card>

        <Card title="Students with access">
          <form action="/admin/enrolments" role="search" className="mb-4 flex flex-wrap gap-3">
            <label htmlFor="q" className="sr-only">Search by name or email</label>
            <input id="q" name="q" defaultValue={q} placeholder="Search by name or email" className={`${inputSm} max-w-sm`} />
            <button className={buttonOutline}>Search</button>
            {q && <Link href="/admin/enrolments" className="inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4">Show everyone</Link>}
          </form>
          {rows.data?.length ? (
            <ul className="divide-y divide-border border-y border-border">
              {rows.data.map((e) => {
                const m = one(e.tenant_members), c = one(e.courses)
                return (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5">
                    <div className="min-w-0 flex-1 basis-60">
                      <p className="t-card !text-[17px] break-words">{m?.display_name}</p>
                      <p className="break-all t-small">{m?.email}</p>
                      <p className="t-small">{c?.title} · {e.status === 'completed' ? 'Finished' : `${Math.round(Number(e.progress_pct))}% done`} · {SOURCE[e.source] ?? e.source}{e.started_at ? ` · since ${dateShort(e.started_at)}` : ''}</p>
                    </div>
                    <ConfirmButton action={revokeAccess.bind(null, e.id)} label="Remove access" name={`Remove access for ${m?.display_name ?? 'this student'}`}
                      yes="Yes, remove access" question={`Stop ${m?.display_name ?? 'this student'} from opening ${c?.title ?? 'this course'}?`} />
                  </li>
                )
              })}
            </ul>
          ) : <Empty icon="user" title={q ? `No one matches “${q}”` : 'No students yet'}>{!q && 'Students appear here when they pay, join free or you give them access.'}</Empty>}
          {(rows.data?.length ?? 0) === 100 && <p className="mt-3 t-small">Showing the newest 100. Search to find someone older.</p>}
        </Card>
      </div>
    </>
  )
}

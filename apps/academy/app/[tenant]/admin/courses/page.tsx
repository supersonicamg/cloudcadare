import Link from 'next/link'
import { can, requireAccess } from '@/lib/dal'
import { buttonOutline, buttonSm, chipClass, inputSm, pageHead, pageTitle, statusTone, td, th, tableWrap } from '@/lib/ui'
import { CreateCourseForm } from './forms'

export const metadata = { title: 'Courses' }

const STATUS: Record<string, string> = { draft: 'Draft', review: 'In review', published: 'Published', archived: 'Archived' }
const PAGE = 25
const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default async function AdminCourses({ searchParams }: PageProps<'/[tenant]/admin/courses'>) {
  const a = await requireAccess({ permission: 'course.view_all', feature: 'catalog.courses' }, '/admin/courses')
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const q = one(sp.q).trim().slice(0, 80)
  const status = Object.keys(STATUS).includes(one(sp.status)) ? one(sp.status) : ''
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one(sp.page), 10) || 1))

  let query = a.db.from('courses')
    .select('id, title, kind, status, lesson_count, updated_at', { count: 'exact' })
    .is('deleted_at', null).order('updated_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  if (status) query = query.eq('status', status)
  if (q) query = query.ilike('title', `%${q.replace(/[\\%_]/g, '\\$&')}%`)
  const { data: courses, count } = await query
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const filtered = Boolean(q || status)
  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams()
    const v = { q, status, page: String(page), ...over }
    for (const [k, val] of Object.entries(v)) if (val && !(k === 'page' && String(val) === '1')) p.set(k, String(val))
    const s = p.toString()
    return `/admin/courses${s ? `?${s}` : ''}`
  }
  const manage = can(a, 'course.manage')

  return (
    <>
      <div className={pageHead}>
        <h1 className={pageTitle}>Courses</h1>
        {manage && (
          <details className="group relative">
            <summary className={`${buttonSm} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>New course</summary>
            <div className="absolute right-0 z-10 mt-2 w-[min(26rem,calc(100vw-2.5rem))] rounded-2xl border border-border bg-white p-5 shadow-lg">
              <h2 className="mb-3 text-lg font-bold">New course</h2>
              <CreateCourseForm />
            </div>
          </details>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-x-5 text-[15px] font-semibold">
          {[['', 'All'], ...Object.entries(STATUS)].map(([k, l]) => (
            <Link key={k} href={href({ status: k ?? '', page: 1 })} aria-current={status === k ? 'page' : undefined}
              className={`py-1.5 ${status === k ? 'text-fg shadow-[0_3px_0_var(--color-accent)]' : 'text-mute hover:text-fg'}`}>{l}</Link>
          ))}
        </nav>
        <form action="/admin/courses" className="flex gap-2" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className="sr-only">Search courses</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search by title" className={`${inputSm} w-56`} />
          <button className={buttonOutline}>Search</button>
        </form>
      </div>

      {!courses?.length ? (
        <p className="border-t-2 border-fg pt-6 text-[17px] text-grey">
          {filtered ? 'No course matches. ' : 'You have not created a course yet. Start with a draft; nothing is public until you publish it.'}
          {filtered && <Link href="/admin/courses" className="font-semibold text-primary underline">Clear the filter</Link>}
        </p>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full text-[15px]">
              <thead className="border-t-2 border-fg">
                <tr><th className={th}>Title</th><th className={th}>Status</th><th className={`${th} text-right`}>Lessons</th><th className={`${th} hidden text-right sm:table-cell`}>Updated</th></tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td className={td}><Link href={`/admin/courses/${c.id}`} className="font-bold text-primary hover:underline">{c.title}</Link></td>
                    <td className={td}><span className={chipClass(statusTone[c.status as keyof typeof statusTone] ?? 'quiet')}>{STATUS[c.status] ?? c.status}</span></td>
                    <td className={`${td} text-right tabular-nums`}>{c.lesson_count}</td>
                    <td className={`${td} hidden whitespace-nowrap text-right sm:table-cell`}>{date.format(new Date(c.updated_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[15px] text-mute">
            <p>{total === 1 ? '1 course' : `${total} courses`}{pages > 1 && ` · page ${page} of ${pages}`}</p>
            {pages > 1 && (
              <div className="flex gap-2">
                {page > 1 && <Link href={href({ page: page - 1 })} className={buttonOutline}>Previous</Link>}
                {page < pages && <Link href={href({ page: page + 1 })} className={buttonOutline}>Next</Link>}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

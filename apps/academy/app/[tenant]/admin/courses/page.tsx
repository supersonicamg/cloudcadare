import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { can, requireAccess } from '@/lib/dal'
import { chipClass, statusTone } from '@/lib/ui'
import { Empty, PageHeader } from '../_components/ui'
import { CreateCourseForm } from './forms'

export const metadata = { title: 'Lessons and videos' }

const STATUS: Record<string, string> = { draft: 'Draft', review: 'In review', published: 'Published', archived: 'Archived' }

export default async function AdminCourses({ searchParams }: PageProps<'/[tenant]/admin/courses'>) {
  const a = await requireAccess({ permission: 'course.view_all', feature: 'catalog.courses' }, '/admin/courses')
  const archived = (await searchParams).status === 'archived'
  let query = a.db.from('courses').select('id, title, status, lesson_count').is('deleted_at', null).order('updated_at', { ascending: false }).limit(100)
  query = archived ? query.eq('status', 'archived') : query.neq('status', 'archived')
  const { data: courses } = await query

  return (
    <>
      <PageHeader title={archived ? 'Old courses' : 'Lessons and videos'} lead={archived ? 'Courses you have put away.' : 'Choose a course to add videos and lessons to it.'}
        back={archived ? { href: '/admin/courses', label: 'Current courses' } : undefined} />

      {courses?.length ? (
        <ul className="grid gap-4">
          {courses.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/courses/${c.id}`} className="group flex flex-wrap items-center gap-4 rounded-[20px] bg-white p-5 ring-1 ring-border hover:shadow-[0_8px_24px_rgba(20,32,31,.10)] sm:p-6">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#E4EFEB] text-primary"><Icon name="book" className="h-7 w-7" /></span>
                <span className="min-w-0 flex-1 basis-56">
                  <span className="block t-card group-hover:!text-primary">{c.title}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-3">
                    <span className={chipClass(statusTone[c.status as keyof typeof statusTone] ?? 'quiet')}>{STATUS[c.status] ?? c.status}</span>
                    <span className="t-small tnum">{c.lesson_count === 1 ? '1 lesson' : `${c.lesson_count} lessons`}</span>
                  </span>
                </span>
                <span className="t-label !text-primary">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty icon="book" title={archived ? 'No old courses' : 'No course yet'}>{!archived && 'Add your first course below. Nobody sees it until you publish it.'}</Empty>}

      {!archived && can(a, 'course.manage') && (
        <details className="mt-6 rounded-[20px] bg-white p-5 ring-1 ring-border" open={!courses?.length}>
          <summary className="min-h-11 cursor-pointer content-center t-card">Add a new course</summary>
          <div className="mt-4"><CreateCourseForm /></div>
        </details>
      )}
      {!archived && <p className="mt-5"><Link href="/admin/courses?status=archived" className="inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4">Show old courses</Link></p>}
    </>
  )
}

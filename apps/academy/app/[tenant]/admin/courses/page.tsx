import Link from 'next/link'
import { can, requireAccess } from '@/lib/dal'
import { CreateCourseForm } from './forms'

export const metadata = { title: 'Courses' }

const STATUS: Record<string, string> = { draft: 'Draft', review: 'In review', published: 'Published', archived: 'Archived' }

export default async function AdminCourses() {
  const a = await requireAccess({ permission: 'course.view_all', feature: 'catalog.courses' }, '/admin/courses')
  const { data: courses } = await a.db.from('courses')
    .select('id, title, kind, status, lesson_count, updated_at').is('deleted_at', null).order('updated_at', { ascending: false }).limit(200)
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Courses</h1>
      {!courses?.length ? (
        <p className="mt-6 text-fg/70">You have not created a course yet. Start with a draft below; nothing is public until you publish it.</p>
      ) : (
        <table className="mt-8 w-full text-left text-[15px]">
          <thead className="border-b border-border text-sm text-fg/65">
            <tr><th className="py-2 pr-4 font-medium">Title</th><th className="pr-4 font-medium">Status</th><th className="pr-4 font-medium">Lessons</th><th className="font-medium">Updated</th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="border-b border-border">
                <td className="py-3 pr-4"><Link href={`/admin/courses/${c.id}`} className="font-medium text-primary hover:underline">{c.title}</Link></td>
                <td className="pr-4">{STATUS[c.status] ?? c.status}</td>
                <td className="pr-4">{c.lesson_count}</td>
                <td>{c.updated_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {can(a, 'course.manage') && (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-semibold">New course</h2>
          <CreateCourseForm />
        </section>
      )}
    </>
  )
}

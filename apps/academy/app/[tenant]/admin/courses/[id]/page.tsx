import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { isEnabled } from '@educore/features'
import { can, holds, requireAccess } from '@/lib/dal'
import { button, buttonQuiet, pageTitle, sectionTitle } from '@/lib/ui'
import { deleteLesson, deleteSection, moveLesson, moveSection, setCourseStatus, stopSelling } from '../actions'
import { AddLessonForm, AddSectionForm, EditCourseForm, PriceForm } from '../forms'

export const metadata = { title: 'Edit course' }

export default async function EditCourse({ params }: PageProps<'/[tenant]/admin/courses/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const a = await requireAccess({ permission: 'course.view_all', feature: 'catalog.courses' }, `/admin/courses/${id}`)

  const { data: course } = await a.db.from('courses').select('*').eq('id', id).is('deleted_at', null).maybeSingle()
  if (!course) notFound()
  const [secs, lessons] = await Promise.all([
    a.db.from('course_sections').select('id, label, title, position').eq('course_id', id).is('deleted_at', null).order('position'),
    a.db.from('lessons').select('id, section_id, title, type, duration_seconds, is_preview, position').eq('course_id', id).is('deleted_at', null).order('position'),
  ])
  const manage = can(a, 'course.manage')

  // What this course sells for, if anything.
  const commerceOn = isEnabled(a.bundle.features, 'commerce.checkout') && holds(a, 'price.manage')
  let sale: { productId: string; status: string; price: number | null; compareAt: number | null; gst: boolean } | null = null
  if (commerceOn) {
    const { data: items } = await a.db.from('product_items').select('product_id').eq('course_id', id)
    if (items?.length) {
      const { data: prod } = await a.db.from('products').select('id, status').in('id', items.map((i) => i.product_id)).is('deleted_at', null).limit(1).maybeSingle()
      if (prod) {
        const { data: pr } = await a.db.from('prices').select('amount_minor, compare_at_minor, tax_rate_id').eq('product_id', prod.id).eq('is_active', true).eq('is_default', true).limit(1).maybeSingle()
        sale = { productId: prod.id, status: prod.status, price: pr?.amount_minor ?? null, compareAt: pr?.compare_at_minor ?? null, gst: Boolean(pr?.tax_rate_id) }
      }
    }
  }
  const selling = sale?.status === 'published'
  const published = course.status === 'published'

  return (
    <>
      <Link href="/admin/courses" className="text-sm text-mute hover:text-fg">&larr; Courses</Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className={pageTitle}>{course.title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-mute">{published ? 'Published' : 'Draft'}</span>
          {published && <Link href={`/courses/${course.slug}`} className="text-sm text-primary underline">View public page</Link>}
          {published && manage && (
            <form action={setCourseStatus.bind(null, id, 'draft')}><button className={buttonQuiet}>Unpublish</button></form>
          )}
          {!published && can(a, 'course.publish') && (
            <form action={setCourseStatus.bind(null, id, 'published')}><button className={button}>Publish</button></form>
          )}
        </div>
      </div>

      {manage ? (
        <section className="mt-10">
          <h2 className={sectionTitle + " mb-4"}>Details</h2>
          <EditCourseForm id={id} v={{
            title: course.title, subtitle: course.subtitle, summary: course.summary, level: course.level, deliveryMode: course.delivery_mode,
            estimatedMinutes: course.estimated_minutes, outcomes: course.outcomes, requirements: course.requirements,
            openEnrolment: ((course.settings ?? {}) as { enrolment?: string }).enrolment === 'open',
            sequential: ((course.settings ?? {}) as { sequential?: boolean }).sequential === true,
            certificate: isEnabled(a.bundle.features, 'learning.certificates') ? ((course.settings ?? {}) as { certificate?: boolean }).certificate !== false : null,
          }} />
        </section>
      ) : <p className="mt-8 text-grey">You can view this course but not edit it.</p>}

      {commerceOn && (
        <section className="mt-14">
          <h2 className="mb-1 text-xl font-semibold">Selling</h2>
          <p className="mb-4 text-grey">{selling && sale?.price ? 'This course is for sale.' : 'This course is not for sale. Free enrolment works only if you switched it on above.'}</p>
          {can(a, 'price.manage') ? (
            <>
              <PriceForm courseId={id} price={sale?.price ?? null} compareAt={sale?.compareAt ?? null} gst={sale?.gst ?? true} selling={Boolean(selling)} />
              {selling && <form action={stopSelling.bind(null, id)} className="mt-4"><button className={buttonQuiet}>Stop selling</button></form>}
            </>
          ) : (
            <p><Link href={`/admin/mfa?next=${encodeURIComponent(`/admin/courses/${id}`)}`} className="text-primary underline">Verify your authenticator code</Link> to change prices.</p>
          )}
        </section>
      )}

      <section className="mt-14">
        <h2 className={sectionTitle + " mb-4"}>Curriculum</h2>
        {!secs.data?.length && <p className="mb-5 text-grey">Add a section first (for example &ldquo;Month 1&rdquo;), then add lessons to it.</p>}
        <div className="space-y-8">
          {secs.data?.map((s, si, allSecs) => (
            <div key={s.id} className="border-t border-border pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-medium">{s.label && <span className="mr-2 text-mute">{s.label}</span>}{s.title}</h3>
                {manage && (
                  <span className="flex items-baseline gap-3">
                    {si > 0 && <form action={moveSection.bind(null, id, s.id, 'up')}><button className="text-sm text-mute hover:text-fg" aria-label={`Move section ${s.title} up`}>Move up</button></form>}
                    {si < allSecs.length - 1 && <form action={moveSection.bind(null, id, s.id, 'down')}><button className="text-sm text-mute hover:text-fg" aria-label={`Move section ${s.title} down`}>Move down</button></form>}
                    <form action={deleteSection.bind(null, s.id)}><button className="text-sm text-danger hover:underline">Remove section</button></form>
                  </span>
                )}
              </div>
              <ul className="mt-3 space-y-1.5 text-[15px]">
                {lessons.data?.filter((l) => l.section_id === s.id).map((l, li, inSection) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-4">
                    <span>{manage ? <Link href={l.type === 'quiz' ? `/admin/courses/${id}/quiz/${l.id}` : `/admin/courses/${id}/lessons/${l.id}`} className="hover:text-primary hover:underline">{l.title}</Link> : l.title} <span className="text-sm text-mute">{l.type.replace('_', ' ')}{l.duration_seconds ? ` · ${Math.round(l.duration_seconds / 60)} min` : ''}{l.is_preview ? ' · free preview' : ''}</span></span>
                    {manage && (
                      <span className="flex items-baseline gap-3">
                        {li > 0 && <form action={moveLesson.bind(null, id, l.id, 'up')}><button className="text-sm text-mute hover:text-fg" aria-label={`Move ${l.title} up`}>Up</button></form>}
                        {li < inSection.length - 1 && <form action={moveLesson.bind(null, id, l.id, 'down')}><button className="text-sm text-mute hover:text-fg" aria-label={`Move ${l.title} down`}>Down</button></form>}
                        <form action={deleteLesson.bind(null, l.id)}><button className="text-sm text-mute hover:text-danger hover:underline">Remove</button></form>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {manage && <AddLessonForm courseId={id} sectionId={s.id} quizzes={isEnabled(a.bundle.features, 'assess.quizzes') && can(a, 'test.manage')} />}
            </div>
          ))}
        </div>
        {manage && <div className="mt-8 border-t border-border pt-6"><AddSectionForm courseId={id} /></div>}
      </section>
    </>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { videoServerFromEnv, videoUploadDirFromEnv } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { Icon, type IconName } from '@educore/ui/marks'
import { can, holds, requireAccess } from '@/lib/dal'
import { buttonOutline, buttonSm } from '@/lib/ui'
import { Card, Empty, PageHeader, Tabs } from '../../_components/ui'
import { ConfirmButton } from '../../_components/confirm'
import { UploadPanel } from '../../_components/upload-panel'
import { VideoUploader } from '../../_components/video-uploader'
import { deleteLesson, deleteSection, moveLesson, moveSection, setCourseStatus, stopSelling } from '../actions'
import { AddLessonForm, AddSectionForm, EditCourseForm, PriceForm, RenameSectionForm } from '../forms'

export const metadata = { title: 'Course' }

const TYPE: Record<string, { name: string; icon: IconName }> = {
  video: { name: 'Video', icon: 'video' }, live: { name: 'Class recording', icon: 'live' }, article: { name: 'Reading page', icon: 'doc' },
  pdf: { name: 'PDF', icon: 'doc' }, download: { name: 'File', icon: 'down' }, external_link: { name: 'Web link', icon: 'link' }, quiz: { name: 'Quiz', icon: 'quiz' },
}

const arrow = 'grid size-11 place-items-center rounded-[10px] text-mute hover:bg-muted hover:text-fg disabled:invisible'
function Move({ action, label, up, disabled }: { action: (f: FormData) => Promise<void>; label: string; up: boolean; disabled: boolean }) {
  return (
    <form action={action}>
      <button className={arrow} aria-label={label} title={label} disabled={disabled}><Icon name="back" className={`h-5 w-5 ${up ? 'rotate-90' : '-rotate-90'}`} /></button>
    </form>
  )
}

export default async function EditCourse({ params, searchParams }: PageProps<'/[tenant]/admin/courses/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const wanted = (await searchParams).tab
  const a = await requireAccess({ permission: 'course.view_all', feature: 'catalog.courses' }, `/admin/courses/${id}`)

  const { data: course } = await a.db.from('courses').select('*').eq('id', id).is('deleted_at', null).maybeSingle()
  if (!course) notFound()
  const manage = can(a, 'course.manage')
  const commerceOn = isEnabled(a.bundle.features, 'commerce.checkout') && holds(a, 'price.manage')
  const tab = wanted === 'details' && manage ? 'details' : wanted === 'price' && commerceOn ? 'price' : 'lessons'
  const published = course.status === 'published'
  const base = `/admin/courses/${id}`
  const canUpload = manage && Boolean(videoUploadDirFromEnv() && videoServerFromEnv())
    && isEnabled(a.bundle.features, 'core.media') && isEnabled(a.bundle.features, 'content.video') && can(a, 'content.upload')

  return (
    <>
      <PageHeader title={course.title} back={{ href: '/admin/courses', label: 'All courses' }}
        lead={published ? 'Published: people can see this course.' : 'Draft: only your team can see this course.'}>
        {published && <Link href={`/courses/${course.slug}`} className={`${buttonOutline} bg-white`}>See it on the website</Link>}
        {published && manage && (
          <ConfirmButton action={setCourseStatus.bind(null, id, 'draft')} label="Hide from website" yes="Yes, hide it"
            question="Hide this course? New people will not see it or be able to buy it." />
        )}
        {!published && can(a, 'course.publish') && <form action={setCourseStatus.bind(null, id, 'published')}><button className={buttonSm}>Publish</button></form>}
        {published && <span className="sr-only">Published</span>}
      </PageHeader>

      <Tabs label="Course" current={tab === 'lessons' ? base : `${base}?tab=${tab}`} items={[
        { href: base, label: 'Lessons and videos' },
        ...(manage ? [{ href: `${base}?tab=details`, label: 'Course details' }] : []),
        ...(commerceOn ? [{ href: `${base}?tab=price`, label: 'Price' }] : []),
      ]} />

      {tab === 'details' && (
        <Card title="About this course" lead="Shown to people before they join.">
          <EditCourseForm id={id} v={{
            title: course.title, subtitle: course.subtitle, summary: course.summary, level: course.level, deliveryMode: course.delivery_mode,
            estimatedMinutes: course.estimated_minutes, outcomes: course.outcomes, requirements: course.requirements,
            openEnrolment: ((course.settings ?? {}) as { enrolment?: string }).enrolment === 'open',
            sequential: ((course.settings ?? {}) as { sequential?: boolean }).sequential === true,
            certificate: isEnabled(a.bundle.features, 'learning.certificates') ? ((course.settings ?? {}) as { certificate?: boolean }).certificate !== false : null,
          }} />
        </Card>
      )}
      {tab === 'price' && <Price id={id} a={a} />}
      {tab === 'lessons' && <Lessons id={id} a={a} manage={manage} canUpload={canUpload} />}
    </>
  )
}

type Access = Awaited<ReturnType<typeof requireAccess>>

async function Lessons({ id, a, manage, canUpload }: { id: string; a: Access; manage: boolean; canUpload: boolean }) {
  const [secs, lessons] = await Promise.all([
    a.db.from('course_sections').select('id, label, title, position').eq('course_id', id).is('deleted_at', null).order('position'),
    a.db.from('lessons').select('id, section_id, title, type, duration_seconds, is_preview, position, media_asset_id, external_url, written:body->>format')
      .eq('course_id', id).is('deleted_at', null).order('position'),
  ])
  const quizzes = isEnabled(a.bundle.features, 'assess.quizzes') && can(a, 'test.manage')
  const sections = secs.data ?? []

  return (
    <div className="grid gap-5">
      {!sections.length && <Empty icon="calendar" title="Start by adding a month">Lessons are grouped by month or topic. Add the first one below, then upload its videos.</Empty>}
      {sections.map((s, si) => {
        const rows = (lessons.data ?? []).filter((l) => l.section_id === s.id)
        return (
          <Card key={s.id}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                {s.label && <p className="t-label !text-primary">{s.label}</p>}
                <h2 className="t-section">{s.title}</h2>
              </div>
              {manage && (
                <div className="flex items-center">
                  <Move up disabled={si === 0} action={moveSection.bind(null, id, s.id, 'up')} label={`Move ${s.title} up`} />
                  <Move up={false} disabled={si === sections.length - 1} action={moveSection.bind(null, id, s.id, 'down')} label={`Move ${s.title} down`} />
                </div>
              )}
            </div>

            {rows.length ? (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {rows.map((l, li) => {
                  const t = TYPE[l.type] ?? { name: l.type, icon: 'doc' as IconName }
                  const video = l.type === 'video' || l.type === 'live'
                  const missing = video ? !l.media_asset_id && !l.external_url
                    : l.type === 'pdf' || l.type === 'download' ? !l.media_asset_id
                    : l.type === 'article' ? !l.written : l.type === 'external_link' ? !l.external_url : false
                  const href = l.type === 'quiz' ? `/admin/courses/${id}/quiz/${l.id}` : `/admin/courses/${id}/lessons/${l.id}`
                  return (
                    <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Icon name={t.icon} className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1 basis-48">
                        {manage ? <Link href={href} className="t-label !text-[16px] !text-fg hover:!text-primary hover:underline">{l.title}</Link> : <p className="t-label !text-fg">{l.title}</p>}
                        <p className="mt-0.5 t-small">{t.name}{l.duration_seconds ? ` · ${Math.round(l.duration_seconds / 60)} min` : ''}{l.is_preview ? ' · free for everyone' : ''}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 t-small !font-semibold ${missing ? 'bg-tint-2 !text-fg' : 'bg-[#E4EFEB] !text-deep'}`}>
                        <Icon name={missing ? 'clock' : 'check'} className="h-4 w-4" />
                        {missing ? (video ? 'No video yet' : 'Empty') : video ? 'Video added' : 'Ready'}
                      </span>
                      {manage && (
                        <div className="flex flex-wrap items-center justify-end">
                          <Link href={href} className="inline-flex min-h-11 items-center px-3 t-label !text-primary">{missing && video ? 'Add video' : 'Edit'}</Link>
                          <Move up disabled={li === 0} action={moveLesson.bind(null, id, l.id, 'up')} label={`Move ${l.title} up`} />
                          <Move up={false} disabled={li === rows.length - 1} action={moveLesson.bind(null, id, l.id, 'down')} label={`Move ${l.title} down`} />
                          <ConfirmButton action={deleteLesson.bind(null, l.id)} label="Delete" name={`Delete ${l.title}`} yes="Yes, delete the lesson" question={`Delete “${l.title}”? Students will no longer see it.`} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : <p className="mt-3 t-body">No lessons here yet.</p>}

            {manage && (
              <div className="mt-4 grid gap-3">
                {canUpload && (
                  <UploadPanel startOpen={!rows.length}><VideoUploader courseId={id} to={{ sectionId: s.id }} /></UploadPanel>
                )}
                <details>
                  <summary className="min-h-11 cursor-pointer content-center t-label !text-primary">Add something else (PDF, quiz, link, empty lesson)</summary>
                  <div className="mt-3"><AddLessonForm courseId={id} sectionId={s.id} quizzes={quizzes} /></div>
                </details>
                <details>
                  <summary className="min-h-11 cursor-pointer content-center t-label !text-mute">Rename or delete this month</summary>
                  <div className="mt-3 grid gap-4 rounded-2xl bg-muted p-4">
                    <RenameSectionForm courseId={id} sectionId={s.id} label={s.label ?? ''} title={s.title} />
                    <ConfirmButton action={deleteSection.bind(null, s.id)} label="Delete this month" yes="Yes, delete it and its lessons"
                      question={`Delete “${s.title}” and its ${rows.length} ${rows.length === 1 ? 'lesson' : 'lessons'}?`} />
                  </div>
                </details>
              </div>
            )}
          </Card>
        )
      })}
      {manage && !canUpload && (
        <p className="rounded-2xl bg-tint-2 p-4 t-label !text-fg">Uploading many videos at once is not set up for this academy. Add a lesson, then open it to add its video.</p>
      )}
      {manage && <Card title="Add a month or topic"><AddSectionForm courseId={id} /></Card>}
    </div>
  )
}

async function Price({ id, a }: { id: string; a: Access }) {
  let sale: { status: string; price: number | null; compareAt: number | null; gst: boolean } | null = null
  const { data: items } = await a.db.from('product_items').select('product_id').eq('course_id', id)
  if (items?.length) {
    const { data: prod } = await a.db.from('products').select('id, status').in('id', items.map((i) => i.product_id)).is('deleted_at', null).limit(1).maybeSingle()
    if (prod) {
      const { data: pr } = await a.db.from('prices').select('amount_minor, compare_at_minor, tax_rate_id').eq('product_id', prod.id).eq('is_active', true).eq('is_default', true).limit(1).maybeSingle()
      sale = { status: prod.status, price: pr?.amount_minor ?? null, compareAt: pr?.compare_at_minor ?? null, gst: Boolean(pr?.tax_rate_id) }
    }
  }
  const selling = sale?.status === 'published'
  return (
    <Card title={selling ? 'This course is on sale' : 'This course is not on sale'}
      lead={selling ? 'Students pay this price to join.' : 'Set a price to start selling. Until then, students join only if you give them access, or if free joining is on in Course details.'}>
      {can(a, 'price.manage') ? (
        <>
          <PriceForm courseId={id} price={sale?.price ?? null} compareAt={sale?.compareAt ?? null} gst={sale?.gst ?? true} selling={Boolean(selling)} />
          {selling && <div className="mt-5 border-t border-border pt-4"><ConfirmButton action={stopSelling.bind(null, id)} label="Stop selling" yes="Yes, stop selling" question="Stop selling this course? Students who already joined keep their access." /></div>}
        </>
      ) : (
        <Link href={`/admin/mfa?next=${encodeURIComponent(`/admin/courses/${id}?tab=price`)}`} className={buttonSm}>Enter your security code to change the price</Link>
      )}
    </Card>
  )
}

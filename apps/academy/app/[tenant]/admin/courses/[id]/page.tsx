import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { videoServerFromEnv, videoUploadDirFromEnv } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { can, holds, requireAccess, type Access } from '@/lib/dal'
import { money } from '@/lib/money'
import { buttonSm, chipClass, statusTone } from '@/lib/ui'
import { Card, PageHeader, Tabs } from '../../_components/ui'
import { ConfirmButton } from '../../_components/confirm'
import { stopSelling } from '../actions'
import { EditCourseForm, PriceForm } from '../forms'
import { Glance, type Sale } from './glance'
import { Outline, lacksContent, type LessonRow, type SectionRow } from './outline'

export const metadata = { title: 'Course' }

const STATUS: Record<string, string> = { draft: 'Draft', review: 'In review', published: 'Published', archived: 'Archived' }

async function loadSale(a: Access, courseId: string): Promise<Sale | null> {
  const { data: items } = await a.db.from('product_items').select('product_id').eq('course_id', courseId)
  if (!items?.length) return null
  const { data: prod } = await a.db.from('products').select('id, status').in('id', items.map((i) => i.product_id)).is('deleted_at', null).limit(1).maybeSingle()
  if (!prod) return null
  const { data: pr } = await a.db.from('prices').select('amount_minor, compare_at_minor, tax_rate_id').eq('product_id', prod.id).eq('is_active', true).eq('is_default', true).limit(1).maybeSingle()
  return { status: prod.status, price: pr?.amount_minor ?? null, compareAt: pr?.compare_at_minor ?? null, gst: Boolean(pr?.tax_rate_id) }
}

export default async function EditCourse({ params, searchParams }: PageProps<'/[tenant]/admin/courses/[id]'>) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const query = await searchParams
  const a = await requireAccess({ permission: 'course.view_all', feature: 'catalog.courses' }, `/admin/courses/${id}`)

  const { data: course } = await a.db.from('courses').select('*').eq('id', id).is('deleted_at', null).maybeSingle()
  if (!course) notFound()
  const manage = can(a, 'course.manage')
  const commerceOn = isEnabled(a.bundle.features, 'commerce.checkout') && holds(a, 'price.manage')
  const tab = query.tab === 'details' && manage ? 'details' : query.tab === 'price' && commerceOn ? 'price' : 'lessons'
  const published = course.status === 'published'
  const base = `/admin/courses/${id}`
  const canUpload = manage && Boolean(videoUploadDirFromEnv() && videoServerFromEnv())
    && isEnabled(a.bundle.features, 'core.media') && isEnabled(a.bundle.features, 'content.video') && can(a, 'content.upload')

  const [secs, lessonData, sale] = await Promise.all([
    a.db.from('course_sections').select('id, label, title, position').eq('course_id', id).is('deleted_at', null).order('position'),
    a.db.from('lessons').select('id, section_id, title, type, duration_seconds, is_preview, media_asset_id, external_url, written:body->>format')
      .eq('course_id', id).is('deleted_at', null).order('position'),
    commerceOn ? loadSale(a, id) : Promise.resolve(null),
  ])
  const sections: SectionRow[] = secs.data ?? []
  const lessons: LessonRow[] = lessonData.data ?? []
  const onlyEmpty = query.show === 'empty' && tab === 'lessons'

  return (
    <>
      <PageHeader title={course.title} back={{ href: '/admin/courses', label: 'All courses' }}
        lead={<span className={chipClass(statusTone[course.status as keyof typeof statusTone] ?? 'quiet')}>{STATUS[course.status] ?? course.status}</span>} />

      <Tabs label="Course" current={tab === 'lessons' ? base : `${base}?tab=${tab}`} items={[
        { href: base, label: 'Lessons and files' },
        ...(manage ? [{ href: `${base}?tab=details`, label: 'Course details' }] : []),
        ...(commerceOn ? [{ href: `${base}?tab=price`, label: 'Price' }] : []),
      ]} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* First in the page so that on a phone the status and Publish come before the long list; on a wide screen it sits to the right. */}
        <div className="lg:col-start-2 lg:row-start-1 lg:self-stretch">
          <Glance id={id} slug={course.slug} published={published} canPublish={can(a, 'course.publish')} manage={manage} commerceOn={commerceOn} sale={sale}
            base={base} filtered={onlyEmpty}
            stats={{ lessons: lessons.length, ready: lessons.filter((l) => !lacksContent(l)).length, seconds: lessons.reduce((n, l) => n + (l.duration_seconds ?? 0), 0) }}
            months={sections.map((s) => {
              const own = lessons.filter((l) => l.section_id === s.id)
              return { id: s.id, title: s.title, lessons: own.length, need: own.filter(lacksContent).length }
            })} />
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
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
          {tab === 'price' && <Price id={id} a={a} sale={sale} />}
          {tab === 'lessons' && <Outline courseId={id} a={a} sections={sections} lessons={lessons} manage={manage} canUpload={canUpload} onlyEmpty={onlyEmpty} base={base} />}
        </div>
      </div>
    </>
  )
}

function Price({ id, a, sale }: { id: string; a: Access; sale: Sale | null }) {
  const selling = sale?.status === 'published'
  return (
    <Card title={selling ? 'This course is on sale' : 'This course is not on sale'}
      lead={selling ? 'Students pay this price to join.' : 'Set a price to start selling. Until then, students join only if you give them access, or if free joining is on in Course details.'}>
      {can(a, 'price.manage') ? (
        <>
          {selling && sale?.price !== null && sale && (
            <p className="mb-5 flex items-baseline gap-3">
              <span className="t-num">{money(sale.price!)}</span>
              {sale.compareAt ? <s className="t-body">{money(sale.compareAt)}</s> : null}
              <span className="t-small">{sale.gst ? 'includes 18% GST' : 'GST not included'}</span>
            </p>
          )}
          <PriceForm courseId={id} price={sale?.price ?? null} compareAt={sale?.compareAt ?? null} gst={sale?.gst ?? true} selling={Boolean(selling)} />
          {selling && <div className="mt-5 border-t border-border pt-4"><ConfirmButton action={stopSelling.bind(null, id)} label="Stop selling" yes="Yes, stop selling" question="Stop selling this course? Students who already joined keep their access." /></div>}
        </>
      ) : (
        <Link href={`/admin/mfa?next=${encodeURIComponent(`/admin/courses/${id}?tab=price`)}`} className={buttonSm}>Enter your security code to change the price</Link>
      )}
    </Card>
  )
}

import 'server-only'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'

// PUBLIC READ DAL. The `anon` role has no database access (plan/07), so anonymous pages read through the
// service client with an explicit tenant filter and an explicit column list. Never select * here, never
// return media paths or anything a visitor should not see. Callers cache results with a tenant-scoped tag.

export interface PublicCourseCard {
  id: string
  slug: string
  kind: string
  title: string
  subtitle: string | null
  summary: string | null
  level: string
  deliveryMode: string
  lessonCount: number
  estimatedMinutes: number | null
  tags: string[]
}

export interface PublicLesson {
  id: string
  title: string
  type: string
  durationSeconds: number | null
  isPreview: boolean
}

export interface PublicSection {
  id: string
  parentId: string | null
  label: string | null
  title: string
  description: string | null
  lessons: PublicLesson[]
  children: PublicSection[]
}

/** What a visitor pays to get the course. Present only while a published product with an active price sells it. */
export interface PublicOffer {
  productId: string
  priceId: string
  amountMinor: number
  compareAtMinor: number | null
  currency: string
  /** Tax is already part of amountMinor (GST-inclusive pricing). */
  taxIncluded: boolean
  taxLabel: string | null
}

export interface PublicCourse extends PublicCourseCard {
  offer: PublicOffer | null
  /** Staff switched "anyone signed in can enrol for free" on. Says nothing about whether a product sells it. */
  enrolmentOpen: boolean
  outcomes: string[]
  requirements: string[]
  sections: PublicSection[]
}

const CARD = 'id, slug, kind, title, subtitle, summary, level, delivery_mode, lesson_count, estimated_minutes, tags'

const toCard = (r: {
  id: string; slug: string; kind: string; title: string; subtitle: string | null; summary: string | null
  level: string; delivery_mode: string; lesson_count: number; estimated_minutes: number | null; tags: string[]
}): PublicCourseCard => ({
  id: r.id, slug: r.slug, kind: r.kind, title: r.title, subtitle: r.subtitle, summary: r.summary, level: r.level,
  deliveryMode: r.delivery_mode, lessonCount: r.lesson_count, estimatedMinutes: r.estimated_minutes, tags: r.tags,
})

export async function getPublishedCourses(tenantId: string): Promise<PublicCourseCard[]> {
  const db = createPrivilegedDb(getPlane(null))
  const { data, error } = await db
    .from('courses').select(CARD)
    .eq('tenant_id', tenantId).eq('status', 'published').eq('visibility', 'public').is('deleted_at', null)
    .order('sort_order').order('published_at', { ascending: false }).limit(200)
  if (error) throw new Error(`catalog read failed: ${error.message}`)
  return (data ?? []).map(toCard)
}

export async function getPublicCourse(tenantId: string, slug: string): Promise<PublicCourse | null> {
  const db = createPrivilegedDb(getPlane(null))
  const { data: c, error } = await db
    .from('courses').select(`${CARD}, outcomes, requirements, settings`)
    .eq('tenant_id', tenantId).eq('slug', slug).in('visibility', ['public', 'unlisted'])
    .eq('status', 'published').is('deleted_at', null).maybeSingle()
  if (error) throw new Error(`course read failed: ${error.message}`)
  if (!c) return null

  const [secs, lessons] = await Promise.all([
    db.from('course_sections').select('id, parent_id, label, title, description, position')
      .eq('tenant_id', tenantId).eq('course_id', c.id).eq('is_published', true).is('deleted_at', null).order('position'),
    db.from('lessons').select('id, section_id, title, type, duration_seconds, is_preview, position')
      .eq('tenant_id', tenantId).eq('course_id', c.id).eq('is_published', true).is('deleted_at', null).order('position'),
  ])
  if (secs.error || lessons.error) throw new Error('curriculum read failed')

  const offer = await getOffer(tenantId, c.id)

  const byId = new Map<string, PublicSection>()
  for (const s of secs.data ?? []) {
    byId.set(s.id, { id: s.id, parentId: s.parent_id, label: s.label, title: s.title, description: s.description, lessons: [], children: [] })
  }
  for (const l of lessons.data ?? []) {
    byId.get(l.section_id)?.lessons.push({ id: l.id, title: l.title, type: l.type, durationSeconds: l.duration_seconds, isPreview: l.is_preview })
  }
  const roots: PublicSection[] = []
  for (const s of byId.values()) {
    const parent = s.parentId ? byId.get(s.parentId) : undefined
    ;(parent ? parent.children : roots).push(s)
  }
  const settings = (c.settings ?? {}) as { enrolment?: string }
  return { ...toCard(c), offer, enrolmentOpen: settings.enrolment === 'open', outcomes: c.outcomes, requirements: c.requirements, sections: roots }
}

/** The product (one course, one-time price) that currently sells this course, if any. Cheapest active price wins. */
async function getOffer(tenantId: string, courseId: string): Promise<PublicOffer | null> {
  const db = createPrivilegedDb(getPlane(null))
  const { data: items } = await db.from('product_items').select('product_id').eq('tenant_id', tenantId).eq('course_id', courseId)
  const ids = (items ?? []).map((i) => i.product_id)
  if (!ids.length) return null
  const { data: products } = await db.from('products').select('id')
    .eq('tenant_id', tenantId).in('id', ids).eq('status', 'published').neq('visibility', 'private').is('deleted_at', null)
  const live = (products ?? []).map((p) => p.id)
  if (!live.length) return null
  const { data: prices } = await db.from('prices')
    .select('id, product_id, amount_minor, compare_at_minor, currency, tax_rate_id, billing_type')
    .eq('tenant_id', tenantId).in('product_id', live).eq('is_active', true).eq('billing_type', 'one_time').order('amount_minor').limit(1)
  const p = prices?.[0]
  if (!p) return null
  let tax: { name: string; is_inclusive: boolean } | null = null
  if (p.tax_rate_id) {
    const { data } = await db.from('tax_rates').select('name, is_inclusive').eq('tenant_id', tenantId).eq('id', p.tax_rate_id).maybeSingle()
    tax = data
  }
  return {
    productId: p.product_id, priceId: p.id, amountMinor: p.amount_minor, compareAtMinor: p.compare_at_minor, currency: p.currency,
    taxIncluded: tax?.is_inclusive ?? false, taxLabel: tax?.name ?? null,
  }
}

// ---------------------------------------------------------------- free previews

export interface PublicPreview {
  course: { id: string; slug: string; title: string }
  lesson: { id: string; title: string; summary: string | null; type: string; body: { format?: string; text?: string } | null; externalUrl: string | null; mediaAssetId: string | null; durationSeconds: number | null }
  /** Other free previews of the same course, for "next preview". */
  more: { id: string; title: string }[]
}

/** One free-preview lesson of a published, public course. Anything that is not an explicit preview is null. */
export async function getPublicPreview(tenantId: string, slug: string, lessonId: string): Promise<PublicPreview | null> {
  const db = createPrivilegedDb(getPlane(null))
  const { data: c } = await db.from('courses').select('id, slug, title')
    .eq('tenant_id', tenantId).eq('slug', slug).in('visibility', ['public', 'unlisted']).eq('status', 'published').is('deleted_at', null).maybeSingle()
  if (!c) return null
  const { data: previews } = await db.from('lessons')
    .select('id, title, summary, type, body, external_url, media_asset_id, duration_seconds, section_id, position')
    .eq('tenant_id', tenantId).eq('course_id', c.id).eq('is_preview', true).eq('is_published', true).is('deleted_at', null).order('position')
  const l = previews?.find((p) => p.id === lessonId)
  if (!l) return null
  return {
    course: c,
    lesson: { id: l.id, title: l.title, summary: l.summary, type: l.type, body: (l.body ?? null) as PublicPreview['lesson']['body'], externalUrl: l.external_url, mediaAssetId: l.media_asset_id, durationSeconds: l.duration_seconds },
    more: (previews ?? []).filter((p) => p.id !== lessonId).map((p) => ({ id: p.id, title: p.title })),
  }
}

/** Is this lesson a free preview of a published course? The file route uses it to serve a PDF to a signed-out visitor. */
export async function previewLessonFile(tenantId: string, lessonId: string): Promise<{ mediaAssetId: string; type: string } | null> {
  const db = createPrivilegedDb(getPlane(null))
  const { data } = await db.from('lessons').select('media_asset_id, type, courses!inner(status, visibility, deleted_at)')
    .eq('tenant_id', tenantId).eq('id', lessonId).eq('is_preview', true).eq('is_published', true).is('deleted_at', null).maybeSingle()
  const c = Array.isArray(data?.courses) ? data.courses[0] : data?.courses
  if (!data || !data.media_asset_id || !c || c.status !== 'published' || c.deleted_at || c.visibility === 'private') return null
  return { mediaAssetId: data.media_asset_id, type: data.type }
}

// ---------------------------------------------------------------- certificate verification

export interface PublicCertificate {
  recipientName: string
  title: string
  serialNo: string
  issuedAt: string
  revoked: boolean
  academy: string
}

/** Anyone with the code can check a certificate. Only what a verifier needs is returned: no member id, no email. */
export async function getCertificateByCode(tenantId: string, code: string): Promise<PublicCertificate | null> {
  if (!/^[A-Z0-9]{12}$/.test(code)) return null
  const db = createPrivilegedDb(getPlane(null))
  const { data } = await db.from('certificates').select('recipient_name, title, serial_no, issued_at, revoked_at')
    .eq('tenant_id', tenantId).eq('verification_code', code).maybeSingle()
  if (!data) return null
  const { data: t } = await db.from('tenants').select('name').eq('id', tenantId).maybeSingle()
  return { recipientName: data.recipient_name, title: data.title, serialNo: data.serial_no, issuedAt: data.issued_at, revoked: data.revoked_at !== null, academy: t?.name ?? '' }
}

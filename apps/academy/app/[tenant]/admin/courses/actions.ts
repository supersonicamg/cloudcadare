'use server'

import { randomBytes } from 'node:crypto'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { Database, Json } from '@educore/db/types'
import { checkFile, createUploadTarget, isFileLessonType, isTeamsRecordingLink, mimeForExt, parseVideoSource, removeFile, safeFilename, statUpload, uploadRule, type UploadTarget, type UploadType } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { ActionDenied, MfaRequired, can, requireActionAccess, type Access } from '@/lib/dal'

export type FormState = { error?: string; saved?: boolean }

const slugify = (t: string) =>
  t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'course'

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20)

const optional = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s ? s : null
}

function message(e: unknown): string {
  if (e instanceof MfaRequired) return 'This needs the two-step check first. Open Security, verify your code, then try again.'
  if (e instanceof ActionDenied) return 'You do not have permission to do that.'
  const m = e instanceof Error ? e.message : String(e)
  if (m.includes('plan_limit_reached')) return 'Your plan has reached its limit for this. Upgrade the plan to add more.'
  return 'Something went wrong. Try again.'
}

const done = (a: Access) => updateTag(`tenant:${a.bundle.tenant.id}:catalog`)

// ------------------------------------------------------------------ courses

const createSchema = z.object({
  title: z.string().trim().min(3, 'Give the course a title of at least 3 characters.').max(120),
  kind: z.enum(['course', 'material_pack', 'test_series', 'live_program']),
})

export async function createCourse(_s: FormState, form: FormData): Promise<FormState> {
  const parsed = createSchema.safeParse({ title: form.get('title'), kind: form.get('kind') ?? 'course' })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' }

  let id: string
  try {
    const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
    let slug = slugify(parsed.data.title)
    for (let attempt = 0; ; attempt++) {
      const { data, error } = await a.db.from('courses')
        .insert({ tenant_id: a.bundle.tenant.id, title: parsed.data.title, kind: parsed.data.kind, slug, created_by: a.memberId })
        .select('id').single()
      if (!error) { id = data.id; break }
      if (error.code === '23505' && attempt < 3) { slug = `${slugify(parsed.data.title)}-${randomBytes(2).toString('hex')}`; continue }
      return { error: message(error) }
    }
    done(a)
  } catch (e) {
    return { error: message(e) }
  }
  redirect(`/admin/courses/${id}`)
}

const updateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subtitle: z.string().trim().max(160).nullable(),
  summary: z.string().trim().max(1000).nullable(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'all']),
  delivery_mode: z.enum(['self_paced', 'cohort', 'live', 'hybrid', 'offline']),
  estimated_minutes: z.number().int().min(0).max(600000).nullable(),
})

export async function updateCourse(courseId: string, _s: FormState, form: FormData): Promise<FormState> {
  const minutes = optional(form.get('estimated_minutes'))
  const parsed = updateSchema.safeParse({
    title: form.get('title'), subtitle: optional(form.get('subtitle')), summary: optional(form.get('summary')),
    level: form.get('level'), delivery_mode: form.get('delivery_mode'),
    estimated_minutes: minutes === null ? null : Number(minutes),
  })
  if (!parsed.success) return { error: 'Check the form: the title needs at least 3 characters and minutes must be a number.' }
  try {
    const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
    // settings is one JSON column shared with other modules: change only our key.
    const { data: cur } = await a.db.from('courses').select('settings').eq('id', courseId).maybeSingle()
    if (!cur) return { error: 'That course was not found.' }
    const { enrolment: _old, sequential: _seq, certificate: oldCert, ...rest } = (cur.settings ?? {}) as Record<string, unknown>
    // The certificate switch only exists where the academy has certificates; elsewhere the stored value is left alone.
    const certificate = isEnabled(a.bundle.features, 'learning.certificates') ? (form.get('certificate') === 'on' ? {} : { certificate: false }) : (oldCert === false ? { certificate: false } : {})
    const settings = { ...rest, ...(form.get('open_enrolment') === 'on' ? { enrolment: 'open' } : {}), ...(form.get('sequential') === 'on' ? { sequential: true } : {}), ...certificate } as { [k: string]: Json }
    const { error, count } = await a.db.from('courses')
      .update({ ...parsed.data, settings, outcomes: lines(form.get('outcomes')), requirements: lines(form.get('requirements')) }, { count: 'exact' })
      .eq('id', courseId)
    if (error) return { error: message(error) }
    if (!count) return { error: 'That course was not found.' }
    done(a)
    return { saved: true }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function setCourseStatus(courseId: string, status: 'published' | 'draft', _form: FormData): Promise<void> {
  const a = await requireActionAccess({ permission: status === 'published' ? 'course.publish' : 'course.manage', feature: 'catalog.courses' })
  const { error } = await a.db.from('courses')
    .update({ status, published_at: status === 'published' ? new Date().toISOString() : null })
    .eq('id', courseId)
  if (error) throw new Error(message(error))
  done(a)
}

// ----------------------------------------------------- sections and lessons

export async function addSection(courseId: string, _s: FormState, form: FormData): Promise<FormState> {
  const title = z.string().trim().min(2).max(120).safeParse(form.get('title'))
  if (!title.success) return { error: 'Give the section a title.' }
  try {
    const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
    const label = optional(form.get('label'))
    const { data: last } = await a.db.from('course_sections').select('position').eq('course_id', courseId).is('parent_id', null).is('deleted_at', null)
      .order('position', { ascending: false }).limit(1).maybeSingle()
    const { error } = await a.db.from('course_sections').insert({
      tenant_id: a.bundle.tenant.id, course_id: courseId, title: title.data, label, position: (last?.position ?? 0) + 1, is_published: true,
    })
    if (error) return { error: message(error) }
    done(a)
    return { saved: true }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function deleteSection(sectionId: string, _form: FormData): Promise<void> {
  const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
  const { error } = await a.db.from('course_sections').update({ deleted_at: new Date().toISOString() }).eq('id', sectionId)
  if (error) throw new Error(message(error))
  // lessons of a removed section must not stay public
  await a.db.from('lessons').update({ deleted_at: new Date().toISOString() }).eq('section_id', sectionId)
  done(a)
}

// Types the learner side can play today. Quizzes are added from the Quizzes screen.
const LESSON_TYPES = ['video', 'live', 'article', 'external_link', 'pdf', 'download', 'quiz'] as const

export async function addLesson(courseId: string, sectionId: string, _s: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({
    title: z.string().trim().min(2).max(160),
    type: z.enum(LESSON_TYPES),
    minutes: z.number().int().min(0).max(1000).nullable(),
  }).safeParse({ title: form.get('title'), type: form.get('type'), minutes: optional(form.get('minutes')) === null ? null : Number(form.get('minutes')) })
  if (!parsed.success) return { error: 'Give the lesson a title and a type.' }
  try {
    const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
    const { data: last } = await a.db.from('lessons').select('position').eq('section_id', sectionId).is('deleted_at', null)
      .order('position', { ascending: false }).limit(1).maybeSingle()
    const now = new Date().toISOString()

    // A quiz lesson owns a test. The lesson completes when the learner passes it (the database does this at grading).
    let testId: string | null = null
    if (parsed.data.type === 'quiz') {
      await requireActionAccess({ permission: 'test.manage', feature: 'assess.quizzes' })
      const { data: t, error: tErr } = await a.db.from('tests').insert({
        tenant_id: a.bundle.tenant.id, course_id: courseId, kind: 'quiz', title: parsed.data.title, status: 'published', created_by: a.memberId,
      }).select('id').single()
      if (tErr) return { error: message(tErr) }
      testId = t.id
    }
    const { error } = await a.db.from('lessons').insert({
      tenant_id: a.bundle.tenant.id, course_id: courseId, section_id: sectionId, title: parsed.data.title, type: parsed.data.type,
      duration_seconds: parsed.data.minutes ? parsed.data.minutes * 60 : null, position: (last?.position ?? 0) + 1,
      is_preview: parsed.data.type === 'quiz' ? false : form.get('is_preview') === 'on', is_published: true, published_at: now,
      ...(testId ? { test_id: testId, completion_rule: { type: 'pass_test' } } : {}),
    })
    if (error) {
      if (testId) await a.db.from('tests').delete().eq('id', testId)
      return { error: message(error) }
    }
    done(a)
    return { saved: true }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function deleteLesson(lessonId: string, _form: FormData): Promise<void> {
  const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
  const { error } = await a.db.from('lessons').update({ deleted_at: new Date().toISOString() }).eq('id', lessonId)
  if (error) throw new Error(message(error))
  done(a)
}

// ------------------------------------------------------- lesson content

const lessonSchema = z.object({
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().max(500).nullable(),
  minutes: z.number().int().min(0).max(1000).nullable(),
})

export async function updateLesson(courseId: string, lessonId: string, _s: FormState, form: FormData): Promise<FormState> {
  const minutes = optional(form.get('minutes'))
  const parsed = lessonSchema.safeParse({ title: form.get('title'), summary: optional(form.get('summary')), minutes: minutes === null ? null : Number(minutes) })
  if (!parsed.success) return { error: 'Check the form: the title needs at least 2 characters and minutes must be a number.' }
  try {
    const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
    const { data: lesson } = await a.db.from('lessons').select('id, type, media_asset_id').eq('id', lessonId).eq('course_id', courseId).is('deleted_at', null).maybeSingle()
    if (!lesson) return { error: 'That lesson was not found.' }

    const patch: Database['public']['Tables']['lessons']['Update'] = {
      title: parsed.data.title, summary: parsed.data.summary, duration_seconds: parsed.data.minutes ? parsed.data.minutes * 60 : null,
      is_preview: form.get('is_preview') === 'on',
    }
    let replacedAsset: string | null = null
    let replacedFile: string | null = null

    // Drip: "open N days after the learner enrolled". Only academies with the feature can change it.
    if (isEnabled(a.bundle.features, 'learning.drip')) {
      const days = optional(form.get('drip_days'))
      if (days === null) patch.unlock_rule = { type: 'always' }
      else {
        const n = Number(days)
        if (!Number.isInteger(n) || n < 0 || n > 3650) return { error: 'Days must be a whole number between 0 and 3650.' }
        patch.unlock_rule = { type: 'days_after_enrolment', days: n }
      }
    }

    if (lesson.type === 'article') {
      const text = String(form.get('text') ?? '').slice(0, 100_000)
      patch.body = { format: 'markdown', text }
    } else if (lesson.type === 'external_link') {
      const url = z.url({ protocol: /^https$/ }).max(2000).safeParse(String(form.get('external_url') ?? '').trim())
      if (!url.success) return { error: 'Enter a link that starts with https://' }
      patch.external_url = url.data
    } else if (lesson.type === 'live') {
      // A class recording is either the uploaded Teams video (the upload form attaches it) or a Teams link typed here.
      const link = String(form.get('recording_url') ?? '').trim()
      if (link) {
        if (link.length > 2000 || !isTeamsRecordingLink(link)) return { error: 'Paste the https share link from Microsoft Teams, Stream, SharePoint or OneDrive.' }
        // It replaces any uploaded video, so it needs the same rights as adding one.
        if (!isEnabled(a.bundle.features, 'content.video') || !can(a, 'content.upload')) return { error: 'You do not have permission to add videos.' }
        patch.external_url = link
        patch.completion_rule = { type: 'view' } // the video is not in our player, so opening it counts
        patch.media_asset_id = null
        replacedAsset = lesson.media_asset_id
        if (replacedAsset) {
          const { data: old } = await a.db.from('media_assets').select('storage_path').eq('id', replacedAsset).maybeSingle()
          replacedFile = old?.storage_path ?? null
        }
      } else if (!lesson.media_asset_id) {
        patch.external_url = null
        patch.completion_rule = { type: 'auto' }
      }
    } else if (lesson.type === 'video') {
      const value = String(form.get('video_value') ?? '').trim()
      if (value) {
        if (!isEnabled(a.bundle.features, 'content.video') || !can(a, 'content.upload')) return { error: 'You do not have permission to add videos.' }
        const source = parseVideoSource(String(form.get('video_kind') ?? ''), value)
        if (!source) return { error: 'That video address is not valid for the type you chose. YouTube links, Mux playback IDs and direct https .mp4 or .m3u8 links work.' }
        const signed = source.provider === 'mux' && form.get('mux_signed') === 'on'
        const { data: asset, error } = await a.db.from('media_assets').insert({
          tenant_id: a.bundle.tenant.id, kind: 'video', provider: source.provider, title: parsed.data.title, status: 'ready',
          playback_id: 'playbackId' in source ? source.playbackId : null,
          metadata: source.provider === 'external_url' ? { url: source.url } : signed ? { signed: true } : {},
          uploaded_by: a.memberId,
        }).select('id').single()
        if (error) return { error: message(error) }
        patch.media_asset_id = asset.id
        replacedAsset = lesson.media_asset_id
      }
    }

    const { error } = await a.db.from('lessons').update(patch).eq('id', lessonId)
    if (error) return { error: message(error) }
    if (replacedAsset) await a.db.from('media_assets').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', replacedAsset)
    if (replacedFile) await removeFile(replacedFile)
    done(a)
    return { saved: true }
  } catch (e) {
    return { error: message(e) }
  }
}

// ----------------------------------------------------------------- selling

const rupees = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').replace(/[,\s₹]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}

/** One product per course, one standard price. Needs product.manage AND price.manage (the latter asks for the MFA code). */
export async function setCoursePrice(courseId: string, _s: FormState, form: FormData): Promise<FormState> {
  const amount = rupees(form.get('price'))
  const compare = rupees(form.get('compare_at'))
  if (amount === null || Number.isNaN(amount) || amount < 100 || amount > 100_000_000) return { error: 'Enter a price between ₹1 and ₹10,00,000.' }
  if (compare !== null && (Number.isNaN(compare) || compare <= amount)) return { error: 'The original price must be higher than the price.' }
  try {
    await requireActionAccess({ permission: 'product.manage', feature: 'commerce.checkout' })
    const a = await requireActionAccess({ permission: 'price.manage', feature: 'commerce.checkout' })
    const t = a.bundle.tenant.id
    const { data: course } = await a.db.from('courses').select('id, slug, title').eq('id', courseId).is('deleted_at', null).maybeSingle()
    if (!course) return { error: 'That course was not found.' }

    const { data: items } = await a.db.from('product_items').select('product_id').eq('course_id', courseId)
    const { data: existing } = items?.length
      ? await a.db.from('products').select('id').in('id', items.map((i) => i.product_id)).is('deleted_at', null).limit(1).maybeSingle()
      : { data: null }

    let productId = existing?.id
    if (productId) {
      const { error } = await a.db.from('products').update({ status: 'published', title: course.title }).eq('id', productId)
      if (error) return { error: message(error) }
    } else {
      let slug = String(course.slug)
      for (let attempt = 0; ; attempt++) {
        const { data, error } = await a.db.from('products').insert({ tenant_id: t, kind: 'course', slug, title: course.title, status: 'published' }).select('id').single()
        if (!error) { productId = data.id; break }
        if (error.code === '23505' && attempt < 3) { slug = `${course.slug}-${randomBytes(2).toString('hex')}`; continue }
        return { error: message(error) }
      }
      const { error } = await a.db.from('product_items').insert({ tenant_id: t, product_id: productId, course_id: courseId })
      if (error) return { error: message(error) }
    }

    let taxRateId: string | null = null
    if (form.get('gst_included') === 'on') {
      const { data: rate } = await a.db.from('tax_rates').select('id').eq('name', 'GST 18%').eq('is_active', true).limit(1).maybeSingle()
      if (rate) taxRateId = rate.id
      else {
        const { data, error } = await a.db.from('tax_rates').insert({ tenant_id: t, name: 'GST 18%', rate_pct: 18, hsn_sac_code: '999293', is_inclusive: true }).select('id').single()
        if (error) return { error: message(error) }
        taxRateId = data.id
      }
    }

    const { data: price } = await a.db.from('prices').select('id').eq('product_id', productId).eq('is_active', true).eq('is_default', true).limit(1).maybeSingle()
    const values = { amount_minor: amount, compare_at_minor: compare, tax_rate_id: taxRateId }
    const { error } = price
      ? await a.db.from('prices').update(values).eq('id', price.id)
      : await a.db.from('prices').insert({ tenant_id: t, product_id: productId, label: 'Standard', is_default: true, ...values })
    if (error) return { error: message(error) }
    done(a)
    return { saved: true }
  } catch (e) {
    return { error: message(e) }
  }
}

export async function stopSelling(courseId: string, _form: FormData): Promise<void> {
  const a = await requireActionAccess({ permission: 'product.manage', feature: 'commerce.checkout' })
  const { data: items } = await a.db.from('product_items').select('product_id').eq('course_id', courseId)
  if (!items?.length) return
  const { error } = await a.db.from('products').update({ status: 'archived' }).in('id', items.map((i) => i.product_id))
  if (error) throw new Error(message(error))
  done(a)
}

// ------------------------------------------------------------- ordering

async function swapWithin(ids: string[], id: string, dir: 'up' | 'down'): Promise<string[] | null> {
  const i = ids.indexOf(id)
  const j = dir === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ids.length) return null
  const next = [...ids]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  return next
}

/** Positions are rewritten 1..n for the whole list, so earlier duplicates or gaps never make a move do nothing. */
export async function moveSection(courseId: string, sectionId: string, dir: 'up' | 'down', _form: FormData): Promise<void> {
  const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
  const { data } = await a.db.from('course_sections').select('id, position').eq('course_id', courseId).is('parent_id', null).is('deleted_at', null).order('position').order('created_at')
  const order = await swapWithin((data ?? []).map((r) => r.id), sectionId, dir)
  if (!order) return
  for (const [n, id] of order.entries()) {
    const { error } = await a.db.from('course_sections').update({ position: n + 1 }).eq('id', id).eq('course_id', courseId)
    if (error) throw new Error(message(error))
  }
  done(a)
}

export async function moveLesson(courseId: string, lessonId: string, dir: 'up' | 'down', _form: FormData): Promise<void> {
  const a = await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
  const { data: l } = await a.db.from('lessons').select('section_id').eq('id', lessonId).eq('course_id', courseId).is('deleted_at', null).maybeSingle()
  if (!l) return
  const { data } = await a.db.from('lessons').select('id').eq('section_id', l.section_id).is('deleted_at', null).order('position').order('created_at')
  const order = await swapWithin((data ?? []).map((r) => r.id), lessonId, dir)
  if (!order) return
  for (const [n, id] of order.entries()) {
    const { error } = await a.db.from('lessons').update({ position: n + 1 }).eq('id', id).eq('section_id', l.section_id)
    if (error) throw new Error(message(error))
  }
  done(a)
}

// ----------------------------------------------------------- file lessons

export type UploadPrep = { error: string } | { target: UploadTarget }

const FILE_ERRORS = {
  type: (t: UploadType) => `That kind of file is not allowed here. Use ${uploadRule(t).label} (${uploadRule(t).exts.join(', ')}).`,
  size: (t: UploadType) => `That file is too large. The limit is ${Math.round(uploadRule(t).maxBytes / 1024 / 1024)} MB.`,
  empty: () => 'That file is empty.',
}

async function fileLesson(courseId: string, lessonId: string) {
  const a = await requireActionAccess({ permission: 'content.upload', feature: 'core.media' })
  const { data: lesson } = await a.db.from('lessons').select('id, type, media_asset_id').eq('id', lessonId).eq('course_id', courseId).is('deleted_at', null).maybeSingle()
  if (!lesson) return null
  const type: UploadType | null = lesson.type === 'live' ? 'recording' : isFileLessonType(lesson.type) ? lesson.type : null
  if (!type) return null
  const feature = type === 'recording' ? 'content.video' : type === 'pdf' ? 'content.documents' : 'content.downloads'
  if (!isEnabled(a.bundle.features, feature)) return null
  return { a, lesson, type }
}

/** Step 1 of an upload: check the file's name and size and hand the browser a one-time upload address. */
export async function prepareFileUpload(courseId: string, lessonId: string, file: { name: string; size: number }): Promise<UploadPrep> {
  try {
    const ctx = await fileLesson(courseId, lessonId)
    if (!ctx) return { error: 'This lesson cannot take a file.' }
    const check = checkFile(ctx.type, String(file.name), Number(file.size))
    if (!check.ok) return { error: FILE_ERRORS[check.reason](ctx.type) }
    return { target: await createUploadTarget(ctx.a.bundle.tenant.id, lessonId, check.ext) }
  } catch (e) {
    return { error: message(e) }
  }
}

/** Step 2: look at what really arrived in storage (not what the browser claims), then attach it to the lesson. */
export async function finishFileUpload(courseId: string, lessonId: string, path: string, originalName: string): Promise<FormState> {
  try {
    const ctx = await fileLesson(courseId, lessonId)
    if (!ctx) return { error: 'This lesson cannot take a file.' }
    const { a } = ctx
    const stat = await statUpload(a.bundle.tenant.id, lessonId, String(path))
    if (!stat) return { error: 'The upload did not arrive. Try again.' }
    const check = checkFile(ctx.type, String(path), stat.size)
    if (!check.ok) { await removeFile(String(path)); return { error: FILE_ERRORS[check.reason](ctx.type) } }

    const { data: asset, error } = await a.db.from('media_assets').insert({
      tenant_id: a.bundle.tenant.id, kind: ctx.type === 'recording' ? 'video' : 'document', provider: 'supabase', title: safeFilename(String(originalName)), status: 'ready',
      storage_bucket: 'course-media', storage_path: path, mime_type: mimeForExt(check.ext), size_bytes: stat.size, uploaded_by: a.memberId,
    }).select('id').single()
    if (error) { await removeFile(String(path)); return { error: message(error) } }

    const { data: old } = ctx.lesson.media_asset_id
      ? await a.db.from('media_assets').select('id, storage_path').eq('id', ctx.lesson.media_asset_id).maybeSingle()
      : { data: null }
    const { error: upErr } = await a.db.from('lessons').update(ctx.type === 'recording'
      ? { media_asset_id: asset.id, external_url: null, completion_rule: { type: 'watch_pct', pct: 90 } }
      : { media_asset_id: asset.id }).eq('id', lessonId)
    if (upErr) return { error: message(upErr) }
    if (old) {
      await a.db.from('media_assets').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', old.id)
      if (old.storage_path) await removeFile(old.storage_path)
    }
    done(a)
    return { saved: true }
  } catch (e) {
    return { error: message(e) }
  }
}

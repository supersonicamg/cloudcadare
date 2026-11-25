'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import {
  UPLOAD_PROBLEMS, UploadFailed, checkServerUpload, discardUpload, finishUpload, removeFile, startUpload, titleFromFileName,
  videoServerFromEnv, videoUploadDirFromEnv, type UploadError,
} from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'

// Uploading a video from the dashboard to the academy's own server: start here, send the pieces to
// /api/video-upload/[uploadId], finish here, which attaches the file to the lesson.

const SAY: Record<UploadError, string> = {
  bad_request: 'That upload was not accepted. Refresh the page and try again.',
  not_found: 'This upload expired. Choose the file again.',
  no_space: 'The server does not have enough free space for this video. Delete old files first.',
  not_a_video: 'This file is not a real MP4 or WebM video.',
  incomplete: 'Part of the file did not arrive. Press Try again.',
}

function message(e: unknown): string {
  if (e instanceof MfaRequired) return 'This needs the two-step check first. Open My security, enter your code, then try again.'
  if (e instanceof ActionDenied) return 'You do not have permission to upload videos.'
  if (e instanceof UploadFailed) return SAY[e.code]
  console.error('video upload failed', e)
  return 'Something went wrong. Try again.'
}

async function context() {
  await requireActionAccess({ permission: 'course.manage', feature: 'catalog.courses' })
  const a = await requireActionAccess({ permission: 'content.upload', feature: 'content.video' })
  const root = videoUploadDirFromEnv()
  if (!root || !videoServerFromEnv() || !isEnabled(a.bundle.features, 'core.media')) throw new ActionDenied()
  return { a, root, slug: a.bundle.tenant.slug }
}

const uuid = z.uuid()

/** For "upload several videos": one lesson per file. A lesson left without a video by a failed try is used again. */
export async function createVideoLesson(courseId: string, sectionId: string, type: 'live' | 'video', fileName: string): Promise<{ error: string } | { lessonId: string }> {
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(sectionId).success || (type !== 'live' && type !== 'video')) return { error: SAY.bad_request }
  try {
    const { a } = await context()
    const { data: section } = await a.db.from('course_sections').select('id').eq('id', sectionId).eq('course_id', courseId).is('deleted_at', null).maybeSingle()
    if (!section) return { error: 'That month was not found.' }
    const title = titleFromFileName(String(fileName))
    const { data: empty } = await a.db.from('lessons').select('id').eq('section_id', sectionId).eq('type', type).eq('title', title)
      .is('media_asset_id', null).is('external_url', null).is('deleted_at', null).limit(1).maybeSingle()
    if (empty) return { lessonId: empty.id }
    const { data: last } = await a.db.from('lessons').select('position').eq('section_id', sectionId).is('deleted_at', null)
      .order('position', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await a.db.from('lessons').insert({
      tenant_id: a.bundle.tenant.id, course_id: courseId, section_id: sectionId, title, type, position: (last?.position ?? 0) + 1,
      is_published: true, published_at: new Date().toISOString(),
    }).select('id').single()
    if (error) return { error: error.message.includes('plan_limit_reached') ? 'Your plan has reached its limit for lessons.' : 'Could not add the lesson. Try again.' }
    updateTag(`tenant:${a.bundle.tenant.id}:catalog`)
    return { lessonId: data.id }
  } catch (e) {
    return { error: message(e) }
  }
}

const videoLesson = async (a: Awaited<ReturnType<typeof context>>['a'], courseId: string, lessonId: string) => {
  const { data } = await a.db.from('lessons').select('id, type, media_asset_id, duration_seconds').eq('id', lessonId).eq('course_id', courseId).is('deleted_at', null).maybeSingle()
  return data && (data.type === 'video' || data.type === 'live') ? data : null
}

export async function startVideoUpload(courseId: string, lessonId: string, file: { name: string; size: number; modified: number }): Promise<{ error: string } | { uploadId: string; received: number }> {
  const check = checkServerUpload(String(file.name), Number(file.size))
  if (!check.ok) return { error: UPLOAD_PROBLEMS[check.reason] }
  try {
    const { a, root, slug } = await context()
    if (!uuid.safeParse(lessonId).success || !await videoLesson(a, courseId, lessonId)) return { error: 'That lesson cannot take a video.' }
    const { id, received } = await startUpload(root, slug, { lessonId, memberId: a.memberId, name: String(file.name).slice(0, 300), size: Number(file.size), modified: Number(file.modified) || 0 })
    return { uploadId: id, received }
  } catch (e) {
    return { error: message(e) }
  }
}

/** The file is complete: move it into place, record it and attach it to the lesson. `seconds` is the browser's reading. */
export async function finishVideoUpload(courseId: string, lessonId: string, uploadId: string, seconds: number | null): Promise<{ error?: string }> {
  try {
    const { a, root, slug } = await context()
    const lesson = uuid.safeParse(lessonId).success ? await videoLesson(a, courseId, lessonId) : null
    if (!lesson) return { error: 'That lesson cannot take a video.' }
    const done = await finishUpload(root, slug, String(uploadId), a.memberId)
    if (done.lessonId !== lessonId) return { error: SAY.bad_request }

    const length = typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 1 && seconds <= 60_000 ? Math.round(seconds) : null
    const { data: asset, error } = await a.db.from('media_assets').insert({
      tenant_id: a.bundle.tenant.id, kind: 'video', provider: 'self_hosted', title: done.path, status: 'ready',
      metadata: { path: done.path }, size_bytes: done.size, duration_seconds: length, uploaded_by: a.memberId,
    }).select('id').single()
    if (error) return { error: 'The video arrived but could not be saved. Press Try again.' }

    const { data: old } = lesson.media_asset_id
      ? await a.db.from('media_assets').select('id, storage_path').eq('id', lesson.media_asset_id).maybeSingle()
      : { data: null }
    const { error: upErr } = await a.db.from('lessons').update({
      media_asset_id: asset.id, external_url: null, completion_rule: { type: 'watch_pct', pct: 90 },
      ...(length ? { duration_seconds: length } : {}),
    }).eq('id', lessonId)
    if (upErr) return { error: 'The video arrived but could not be added to the lesson. Press Try again.' }
    // The previous recording stays on the video server (another lesson may use it); only its record goes.
    if (old) {
      await a.db.from('media_assets').update({ deleted_at: new Date().toISOString(), status: 'deleted' }).eq('id', old.id)
      if (old.storage_path) await removeFile(old.storage_path)
    }
    await discardUpload(root, slug, String(uploadId))
    updateTag(`tenant:${a.bundle.tenant.id}:catalog`)
    return {}
  } catch (e) {
    return { error: message(e) }
  }
}

export async function cancelVideoUpload(uploadId: string): Promise<void> {
  const { root, slug } = await context()
  await discardUpload(root, slug, String(uploadId))
}

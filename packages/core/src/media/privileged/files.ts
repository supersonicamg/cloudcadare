import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'
import { FILE_BUCKET, extOf, mimeForExt, safeFilename } from '../files'

// FILE STORAGE for lesson files (PDF, downloads). Files sit in the private `course-media` bucket under
// {tenant}/lessons/{lesson}/. Nobody reads the bucket directly: the app first proves the person may see the LESSON,
// then hands out a short-lived signed URL. Staff upload straight to Supabase Storage through a signed upload URL,
// so file bytes never pass through the app server.

const db = () => createPrivilegedDb(getPlane(null))
const folder = (tenantId: string, lessonId: string) => `${tenantId}/lessons/${lessonId}`

export interface UploadTarget { path: string; token: string; signedUrl: string }

export async function createUploadTarget(tenantId: string, lessonId: string, ext: string): Promise<UploadTarget> {
  const path = `${folder(tenantId, lessonId)}/${randomUUID()}.${ext}`
  const { data, error } = await db().storage.from(FILE_BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw new Error(`upload url failed: ${error?.message}`)
  return { path, token: data.token, signedUrl: data.signedUrl }
}

/** After the browser says it uploaded: look at what is really in storage. The browser's own size and type are not trusted. */
export async function statUpload(tenantId: string, lessonId: string, path: string): Promise<{ size: number; mime: string } | null> {
  const prefix = folder(tenantId, lessonId)
  if (!path.startsWith(`${prefix}/`) || path.slice(prefix.length + 1).includes('/')) return null
  const name = path.slice(prefix.length + 1)
  const { data, error } = await db().storage.from(FILE_BUCKET).list(prefix, { search: name, limit: 5 })
  if (error) throw new Error(`storage list failed: ${error.message}`)
  const o = data?.find((x) => x.name === name)
  if (!o) return null
  const meta = (o.metadata ?? {}) as { size?: number; mimetype?: string }
  return { size: Number(meta.size ?? 0), mime: meta.mimetype ?? mimeForExt(extOf(name)) }
}

export async function removeFile(path: string): Promise<void> {
  await db().storage.from(FILE_BUCKET).remove([path])
}

export interface FileInfo { title: string; ext: string; mime: string | null; sizeBytes: number | null }

/** What a lesson page shows about the attached file. No storage path leaves the server. */
export async function describeFile(tenantId: string, mediaAssetId: string): Promise<FileInfo | null> {
  const { data } = await db().from('media_assets').select('title, storage_path, mime_type, size_bytes, status')
    .eq('tenant_id', tenantId).eq('id', mediaAssetId).is('deleted_at', null).maybeSingle()
  if (!data || data.status !== 'ready' || !data.storage_path) return null
  return { title: data.title ?? 'File', ext: extOf(data.storage_path), mime: data.mime_type, sizeBytes: data.size_bytes }
}

/** A link that works for one minute. `download` makes the browser save it under the original name. */
export async function signedFileUrl(tenantId: string, mediaAssetId: string, opts: { download?: boolean } = {}): Promise<string | null> {
  const d = db()
  const { data } = await d.from('media_assets').select('title, storage_bucket, storage_path, status')
    .eq('tenant_id', tenantId).eq('id', mediaAssetId).is('deleted_at', null).maybeSingle()
  if (!data || data.status !== 'ready' || data.storage_bucket !== FILE_BUCKET || !data.storage_path) return null
  const { data: signed, error } = await d.storage.from(FILE_BUCKET).createSignedUrl(
    data.storage_path, 60, opts.download ? { download: safeFilename(data.title ?? 'file') } : undefined,
  )
  if (error || !signed) return null
  return signed.signedUrl
}

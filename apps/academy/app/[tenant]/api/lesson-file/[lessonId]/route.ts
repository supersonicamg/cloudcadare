import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerDb, getPlane } from '@educore/auth'
import { previewLessonFile } from '@educore/core/catalog'
import { isFileLessonType, signedFileUrl } from '@educore/core/media'
import { resolveTenantFromHost } from '@/lib/dal'

// A lesson file (PDF or download). The bucket is private: this route first proves the person may see the LESSON,
// then redirects to a signed link that lasts one minute. Free previews are open to signed-out visitors.

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request, { params }: RouteContext<'/[tenant]/api/lesson-file/[lessonId]'>) {
  const { lessonId } = await params
  if (!z.uuid().safeParse(lessonId).success) return new Response('Not found', { status: 404, headers: noStore })
  const bundle = await resolveTenantFromHost()
  if (!bundle) return new Response('Not found', { status: 404, headers: noStore })
  const tenantId = bundle.tenant.id

  let mediaAssetId: string | null = null
  const preview = await previewLessonFile(tenantId, lessonId)
  if (preview && isFileLessonType(preview.type)) mediaAssetId = preview.mediaAssetId
  else {
    // RLS on `lessons` is the check: enrolled (and not expired), or a free preview, or staff.
    const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
    const { data: claims } = await db.auth.getClaims()
    if (!claims?.claims) return new Response('Sign in to open this file', { status: 401, headers: noStore })
    const { data: lesson } = await db.from('lessons').select('type, media_asset_id').eq('id', lessonId).eq('is_published', true).is('deleted_at', null).maybeSingle()
    if (lesson?.media_asset_id && isFileLessonType(lesson.type)) mediaAssetId = lesson.media_asset_id
  }
  if (!mediaAssetId) return new Response('Not found', { status: 404, headers: noStore })

  const url = await signedFileUrl(tenantId, mediaAssetId, { download: new URL(request.url).searchParams.get('download') === '1' })
  if (!url) return new Response('Not found', { status: 404, headers: noStore })
  return new Response(null, { status: 302, headers: { Location: url, ...noStore } })
}

import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerDb, getPlane } from '@educore/auth'
import { previewLessonFile } from '@educore/core/catalog'
import { signedFileUrl } from '@educore/core/media'
import { resolveTenantFromHost } from '@/lib/dal'

// A lesson file (PDF or picture), shown in the page and never offered for download. The bucket is private: this route first proves the person may see the LESSON,
// then redirects to a signed link that lasts one minute. Free previews are open to signed-out visitors.

const noStore = { 'Cache-Control': 'private, no-store' }

export async function GET(_request: Request, { params }: RouteContext<'/[tenant]/api/lesson-file/[lessonId]'>) {
  const { lessonId } = await params
  if (!z.uuid().safeParse(lessonId).success) return new Response('Not found', { status: 404, headers: noStore })
  const bundle = await resolveTenantFromHost()
  if (!bundle) return new Response('Not found', { status: 404, headers: noStore })
  const tenantId = bundle.tenant.id

  let mediaAssetId: string | null = null
  const preview = await previewLessonFile(tenantId, lessonId)
  if (preview && preview.type === 'pdf') mediaAssetId = preview.mediaAssetId
  else {
    // RLS on `lessons` is the check: enrolled (and not expired), or a free preview, or staff.
    const db = createServerDb(getPlane(bundle.tenant.planeId), await cookies())
    const { data: claims } = await db.auth.getClaims()
    if (!claims?.claims) return new Response('Sign in to open this file', { status: 401, headers: noStore })
    const { data: lesson } = await db.from('lessons').select('type, media_asset_id').eq('id', lessonId).eq('is_published', true).is('deleted_at', null).maybeSingle()
    // Only what the page shows inline is served (PDF, picture); "file to download" lessons are never handed out. Pictures (plan/16 B6) are served the same way as PDFs: row-level security first, then a one-minute link.
    if (lesson?.media_asset_id && (lesson.type === 'pdf' || lesson.type === 'image')) mediaAssetId = lesson.media_asset_id
  }
  if (!mediaAssetId) return new Response('Not found', { status: 404, headers: noStore })

  const url = await signedFileUrl(tenantId, mediaAssetId)
  if (!url) return new Response('Not found', { status: 404, headers: noStore })
  return new Response(null, { status: 302, headers: { Location: url, ...noStore } })
}

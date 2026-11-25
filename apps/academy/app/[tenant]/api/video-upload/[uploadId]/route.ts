import { UPLOAD_CHUNK_BYTES, UploadFailed, appendChunk, videoUploadDirFromEnv } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { ActionDenied, requireActionAccess } from '@/lib/dal'

// One piece of a video being uploaded from the dashboard (plan/17 §8). Starting and finishing are server actions
// (admin/courses/upload-actions.ts); only the bytes come through here. Signed-in staff with upload rights only.

const reply = (status: number, body: object = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

/** Reads at most one piece, whatever the headers claim. */
async function readPiece(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return null
  const parts: Uint8Array[] = []
  let size = 0
  for await (const part of request.body as unknown as AsyncIterable<Uint8Array>) {
    size += part.length
    if (size > UPLOAD_CHUNK_BYTES) return null
    parts.push(part)
  }
  return Buffer.concat(parts)
}

export async function PUT(request: Request, { params }: RouteContext<'/[tenant]/api/video-upload/[uploadId]'>) {
  const { uploadId } = await params
  // Cookies travel between sibling subdomains, so only our own pages may send bytes here.
  const origin = request.headers.get('origin')
  if (!origin || URL.parse(origin)?.host !== request.headers.get('host')) return reply(403)
  const offset = Number(new URL(request.url).searchParams.get('offset'))
  if (!Number.isSafeInteger(offset) || offset < 0) return reply(400)
  try {
    const a = await requireActionAccess({ permission: 'content.upload', feature: 'content.video' })
    const root = videoUploadDirFromEnv()
    if (!root || !isEnabled(a.bundle.features, 'core.media')) return reply(404)
    const piece = await readPiece(request)
    if (!piece) return reply(413)
    const res = await appendChunk(root, a.bundle.tenant.slug, uploadId, a.memberId, offset, piece)
    return reply(res.ok ? 200 : 409, { received: res.received })
  } catch (e) {
    if (e instanceof ActionDenied) return reply(403)
    if (e instanceof UploadFailed) return reply(e.code === 'not_found' ? 404 : 400)
    console.error('video upload piece failed', e)
    return reply(500)
  }
}

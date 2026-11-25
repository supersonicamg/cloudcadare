import 'server-only'
import { signServerVideoUrl, type VideoServer } from '../server-video'

export type ServerVideoCheck = { ok: true; sizeBytes: number | null } | { ok: false; reason: 'missing' | 'refused' | 'unreachable' }

/** Asks the video server for the file's headers, so a wrong name or secret shows up when staff save, not when a learner plays. */
export async function checkServerVideo(server: VideoServer, slug: string, path: string): Promise<ServerVideoCheck> {
  try {
    const res = await fetch(signServerVideoUrl(server, slug, path, { ttlSeconds: 60 }), { method: 'HEAD', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (res.status === 404) return { ok: false, reason: 'missing' }
    if (res.status === 403 || res.status === 410) return { ok: false, reason: 'refused' }
    // Anything but a video (a proxy's welcome or error page) means the address points somewhere else.
    if (!res.ok || !res.headers.get('content-type')?.startsWith('video/')) return { ok: false, reason: 'unreachable' }
    const size = Number(res.headers.get('content-length'))
    return { ok: true, sizeBytes: Number.isSafeInteger(size) && size > 0 ? size : null }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

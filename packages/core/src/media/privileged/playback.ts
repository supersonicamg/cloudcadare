import 'server-only'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'
import { FILE_BUCKET } from '../files'
import { isDirectVideoUrl, youtubeId } from '../source'
import { muxSigningFromEnv, signMuxToken } from '../mux'
import { serverVideoPath, signServerVideoUrl, videoServerFromEnv } from '../server-video'

// PLAYBACK RESOLVER. media_assets is staff-only under RLS, so a learner's player cannot read it. The page
// first proves the learner may see the LESSON (RLS on `lessons`), then calls this with that lesson's
// media_asset_id. It returns only what the player needs; storage paths and provider ids stay server-side.

export type Playback =
  | { kind: 'hls'; src: string }
  | { kind: 'file'; src: string }
  | { kind: 'youtube'; videoId: string }
  | { kind: 'unavailable'; reason: 'not_ready' | 'not_configured' | 'unsupported' }

export async function resolvePlayback(tenantId: string, mediaAssetId: string): Promise<Playback> {
  const db = createPrivilegedDb(getPlane(null))
  const { data: a, error } = await db
    .from('media_assets').select('provider, playback_id, status, metadata, storage_bucket, storage_path, mime_type')
    .eq('tenant_id', tenantId).eq('id', mediaAssetId).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(`media read failed: ${error.message}`)
  if (!a || a.status !== 'ready') return { kind: 'unavailable', reason: 'not_ready' }

  const meta = (a.metadata ?? {}) as { url?: string; signed?: boolean; path?: string }
  switch (a.provider) {
    case 'youtube': {
      const id = a.playback_id ? youtubeId(a.playback_id) : null
      return id ? { kind: 'youtube', videoId: id } : { kind: 'unavailable', reason: 'not_ready' }
    }
    case 'external_url': {
      const u = meta.url ? isDirectVideoUrl(meta.url) : null
      if (!u) return { kind: 'unavailable', reason: 'not_ready' }
      return { kind: /\.m3u8$/i.test(u.pathname) ? 'hls' : 'file', src: u.toString() }
    }
    case 'mux': {
      if (!a.playback_id) return { kind: 'unavailable', reason: 'not_ready' }
      const base = `https://stream.mux.com/${encodeURIComponent(a.playback_id)}.m3u8`
      if (!meta.signed) return { kind: 'hls', src: base }
      const signing = muxSigningFromEnv()
      if (!signing) return { kind: 'unavailable', reason: 'not_configured' }
      return { kind: 'hls', src: `${base}?token=${signMuxToken(a.playback_id, signing)}` }
    }
    case 'self_hosted': {
      const server = videoServerFromEnv()
      if (!server) return { kind: 'unavailable', reason: 'not_configured' }
      const path = meta.path ? serverVideoPath(meta.path) : null
      if (!path) return { kind: 'unavailable', reason: 'not_ready' }
      // The folder is this academy's own, whatever the row says.
      const { data: t, error: tenantError } = await db.from('tenants').select('slug').eq('id', tenantId).single()
      if (tenantError) throw new Error(`tenant read failed: ${tenantError.message}`)
      return { kind: 'file', src: signServerVideoUrl(server, t.slug, path) }
    }
    case 'supabase': {
      // An uploaded class recording. The link lasts long enough to watch a two-hour class with pauses.
      if (a.storage_bucket !== FILE_BUCKET || !a.storage_path || !a.mime_type?.startsWith('video/')) return { kind: 'unavailable', reason: 'unsupported' }
      const { data: signed, error: signError } = await db.storage.from(FILE_BUCKET).createSignedUrl(a.storage_path, 4 * 60 * 60)
      return signError || !signed ? { kind: 'unavailable', reason: 'not_ready' } : { kind: 'file', src: signed.signedUrl }
    }
    default:
      return { kind: 'unavailable', reason: 'unsupported' }
  }
}

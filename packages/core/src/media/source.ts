// Pure helpers for video sources. No I/O: used by admin actions to validate what staff paste, and by the
// playback resolver. Anything that reaches a <video src> or an iframe must pass through here first.

export type VideoSource =
  | { provider: 'youtube'; playbackId: string }
  | { provider: 'mux'; playbackId: string }
  | { provider: 'external_url'; url: string }

const YT_ID = /^[A-Za-z0-9_-]{11}$/
const MUX_ID = /^[A-Za-z0-9]{8,80}$/

export function youtubeId(input: string): string | null {
  const raw = input.trim()
  if (YT_ID.test(raw)) return raw
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)
      id = m?.[1] ?? null
    }
  }
  return id && YT_ID.test(id) ? id : null
}

export function isDirectVideoUrl(input: string): URL | null {
  let u: URL
  try { u = new URL(input.trim()) } catch { return null }
  if (u.protocol !== 'https:' || u.username || u.password) return null
  return /\.(mp4|webm|m3u8)$/i.test(u.pathname) ? u : null
}

/** `kind` is what the admin chose in the form; the value is what they pasted. Returns null when it is not valid. */
export function parseVideoSource(kind: string, value: string): VideoSource | null {
  const v = value.trim()
  if (kind === 'youtube') { const id = youtubeId(v); return id ? { provider: 'youtube', playbackId: id } : null }
  if (kind === 'mux') return MUX_ID.test(v) ? { provider: 'mux', playbackId: v } : null
  if (kind === 'url') { const u = isDirectVideoUrl(v); return u ? { provider: 'external_url', url: u.toString() } : null }
  return null
}

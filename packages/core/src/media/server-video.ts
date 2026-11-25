import { createHash } from 'node:crypto'

// VIDEOS ON OUR OWN SERVER (plan/17 §8). Files sit in <video root>/<academy slug>/ and nginx serves them only for a
// signed, expiring address (the `secure_link` module). The database keeps the path inside the academy's folder; the
// slug is added here, so one academy can never name another's file.

export interface VideoServer { url: string; secret: string }

/** Both settings, or null: VIDEO_SERVER_URL is an https origin, VIDEO_SERVER_SECRET matches the nginx config. */
export function videoServerFromEnv(env: Record<string, string | undefined> = process.env): VideoServer | null {
  const secret = env.VIDEO_SERVER_SECRET?.trim()
  let u: URL
  try { u = new URL(env.VIDEO_SERVER_URL?.trim() ?? '') } catch { return null }
  // An origin only: nginx signs the whole path, so a prefix here would break every signature.
  if (u.protocol !== 'https:' || u.pathname !== '/' || u.search || u.hash || u.username || u.password) return null
  return secret && secret.length >= 16 ? { url: u.origin, secret } : null
}

/** A file path inside the academy's folder, such as "month-1/lesson 01.mp4". Returns null for anything else. */
export function serverVideoPath(input: string): string | null {
  const path = input.trim().replace(/^\/+/, '')
  if (!path || path.length > 300 || /[\\\x00-\x1f\x7f]/.test(path) || !/\.(mp4|webm)$/i.test(path)) return null
  // No empty, "." or ".." parts and no hidden files: nginx would resolve them to a different path than the one signed.
  return path.split('/').every((part) => part && !part.startsWith('.')) ? path : null
}

/** The address a player may use until it expires. The default covers a two-hour class with pauses. */
export function signServerVideoUrl(server: VideoServer, slug: string, path: string, opts: { now?: number; ttlSeconds?: number } = {}): string {
  const expires = (opts.now ?? Math.floor(Date.now() / 1000)) + (opts.ttlSeconds ?? 4 * 60 * 60)
  const uri = `/${slug}/${path}`
  // nginx: secure_link_md5 "$secure_link_expires$uri SECRET", where $uri is the decoded path.
  const md5 = createHash('md5').update(`${expires}${uri} ${server.secret}`).digest('base64url')
  return `${server.url}${uri.split('/').map(encodeURIComponent).join('/')}?md5=${md5}&expires=${expires}`
}

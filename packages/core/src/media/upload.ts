// Rules for uploading a video to our own server (plan/17 §8). Pure: used by the browser and the server alike.

/** Sent in pieces: below Next's 10 MB proxy limit, and a failed piece is the only thing sent again. */
export const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024
export const MAX_SERVER_VIDEO_BYTES = 4 * 1024 * 1024 * 1024

export type VideoCheck = { ok: true; ext: 'mp4' | 'webm' } | { ok: false; reason: 'type' | 'size' | 'empty' }

export function checkServerUpload(name: string, size: number): VideoCheck {
  const ext = /\.(mp4|webm)$/i.exec(name.trim())?.[1]?.toLowerCase() as 'mp4' | 'webm' | undefined
  if (!ext) return { ok: false, reason: 'type' }
  if (!Number.isSafeInteger(size) || size <= 0) return { ok: false, reason: 'empty' }
  return size > MAX_SERVER_VIDEO_BYTES ? { ok: false, reason: 'size' } : { ok: true, ext }
}

export const UPLOAD_PROBLEMS = {
  type: 'Choose an MP4 or WebM video.',
  size: 'This video is larger than 4 GB. Compress it first.',
  empty: 'This file is empty.',
} as const

/** The name the file gets on the server: the person's own name for it, minus anything a path or address could misread. */
export function videoFileName(name: string, ext: 'mp4' | 'webm'): string {
  const base = name.replace(/\.[^.]*$/, '').normalize('NFC').replace(/[\\/\x00-\x1f\x7f<>:"|*?]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^[.\s]+/, '').slice(0, 120).trim()
  return `${base || 'video'}.${ext}`
}

/** A lesson title suggested from a file name: "Session_6 - Virtual Network.mp4" -> "Session 6 - Virtual Network". */
export function titleFromFileName(name: string): string {
  const t = name.replace(/\.[^.]*$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
  return t.length >= 2 ? t : 'New video'
}

/** The first bytes must be what the ending says: an MP4 box ("ftyp") or a WebM (EBML) header. */
export function looksLikeVideo(head: Uint8Array, ext: 'mp4' | 'webm'): boolean {
  if (ext === 'webm') return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3
  return head.length >= 8 && String.fromCharCode(...head.slice(4, 8)) === 'ftyp'
}

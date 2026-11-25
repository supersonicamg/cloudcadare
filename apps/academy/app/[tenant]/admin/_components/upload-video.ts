import { UPLOAD_CHUNK_BYTES } from '@educore/core/media/upload'

// The browser's side of an upload: send the pieces in order, retry a failed one, and continue from wherever the
// server says the file ends.

export class Stopped extends Error {}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function sendPieces(file: File, uploadId: string, from: number, signal: AbortSignal, onProgress: (sent: number) => void): Promise<void> {
  let offset = from
  let failures = 0
  onProgress(offset)
  while (offset < file.size) {
    if (signal.aborted) throw new Stopped()
    try {
      const res = await fetch(`/api/video-upload/${uploadId}?offset=${offset}`, {
        method: 'PUT', body: file.slice(offset, offset + UPLOAD_CHUNK_BYTES), signal, headers: { 'Content-Type': 'application/octet-stream' },
      })
      if (res.status === 403) throw new Stopped('You are signed out, or you may not upload videos. Refresh the page and sign in again.')
      if (res.status === 404) throw new Stopped('This upload expired. Choose the file again.')
      if (!res.ok && res.status !== 409) throw new Error(`status ${res.status}`)
      const { received } = (await res.json()) as { received: number }
      // "Continue from here" without moving forward counts as a failure, so this cannot loop for ever.
      if (received === offset) throw new Error('no progress')
      offset = received
      failures = 0
      onProgress(offset)
    } catch (e) {
      if (signal.aborted) throw new Stopped()
      if (e instanceof Stopped) throw e
      if (++failures > 5) throw new Stopped('The connection kept failing. Check your internet and press Try again: it continues where it stopped.')
      await wait(1000 * 2 ** (failures - 1))
    }
  }
}

/** The video's length, as the browser reads it. Null when it cannot tell. */
export function videoSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(file)
    const done = (n: number | null) => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(n) }
    const timer = setTimeout(() => done(null), 8000)
    v.preload = 'metadata'
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null)
    v.onerror = () => done(null)
    v.src = url
  })
}

import type { UploadType } from '@educore/core/media/files'
import { finishFileUpload, prepareFileUpload } from '../courses/actions'

/**
 * Puts one file into a lesson: ask for a one-time address, send the file straight to storage (so we can show real
 * progress), then tell the server to check and attach it. Returns the problem in plain words, or nothing.
 */
export async function sendFile(
  courseId: string, lessonId: string, type: UploadType, file: File, onProgress: (percent: number) => void, signal: AbortSignal,
): Promise<{ error?: string; cancelled?: boolean }> {
  try {
    const prep = await prepareFileUpload(courseId, lessonId, { name: file.name, size: file.size })
    if ('error' in prep) return { error: prep.error }
    if (signal.aborted) return { cancelled: true }

    const sent = await new Promise<boolean>((resolve) => {
      const x = new XMLHttpRequest()
      x.open('PUT', prep.target.signedUrl)
      x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.min(99, Math.floor((e.loaded / e.total) * 100))) }
      x.onload = () => resolve(x.status >= 200 && x.status < 300)
      x.onerror = () => resolve(false)
      x.onabort = () => resolve(false)
      signal.addEventListener('abort', () => x.abort(), { once: true })
      const body = new FormData()
      body.append('cacheControl', '3600')
      body.append('', file)
      x.send(body)
    })
    if (signal.aborted) return { cancelled: true }
    if (!sent) return { error: 'The upload did not go through. Check your internet and press Try again.' }

    const done = await finishFileUpload(courseId, lessonId, prep.target.path, file.name)
    if (done.error) return { error: done.error }
    onProgress(100)
    return {}
  } catch {
    return { error: 'The upload did not go through. Check your internet and press Try again.' }
  }
}

export const FILE_PROBLEMS = {
  type: (type: UploadType, label: string) => type === 'pdf' ? `${label}: this is not a PDF. For Word, Excel or other files, add it as a file to download.` : `${label}: this kind of file is not allowed here.`,
  size: (label: string, mb: number) => `${label}: this file is too large. The limit is ${mb} MB.`,
  empty: (label: string) => `${label}: this file is empty.`,
} as const

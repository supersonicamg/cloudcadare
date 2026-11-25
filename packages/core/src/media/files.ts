// Pure rules for uploaded lesson files (no I/O, unit tested).

export const FILE_BUCKET = 'course-media'

/** What each lesson type accepts. PDF lessons show the file in the page; "download" lessons offer it as a file. */
export const FILE_RULES = {
  pdf: { exts: ['pdf'], maxBytes: 100 * 1024 * 1024, label: 'a PDF' },
  download: {
    exts: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'md'],
    maxBytes: 200 * 1024 * 1024,
    label: 'a document, archive or image',
  },
} as const

export type FileLessonType = keyof typeof FILE_RULES
export const isFileLessonType = (t: string): t is FileLessonType => t === 'pdf' || t === 'download'

const MIME: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain', csv: 'text/csv', md: 'text/markdown',
}
export const mimeForExt = (ext: string) => MIME[ext] ?? 'application/octet-stream'

export const extOf = (filename: string) => {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(filename.trim())
  return m ? m[1]!.toLowerCase() : ''
}

export type FileCheck = { ok: true; ext: string } | { ok: false; reason: 'type' | 'size' | 'empty' }

/** Decides, before any upload URL is issued, whether a file may go into this kind of lesson. */
export function checkFile(type: FileLessonType, filename: string, sizeBytes: number): FileCheck {
  const rule = FILE_RULES[type]
  const ext = extOf(filename)
  if (!(rule.exts as readonly string[]).includes(ext)) return { ok: false, reason: 'type' }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { ok: false, reason: 'empty' }
  if (sizeBytes > rule.maxBytes) return { ok: false, reason: 'size' }
  return { ok: true, ext }
}

/** A name safe to put in a Content-Disposition header and show to people. */
export const safeFilename = (name: string) =>
  name.replace(/[\\/\0-\x1f"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file'

export const humanSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

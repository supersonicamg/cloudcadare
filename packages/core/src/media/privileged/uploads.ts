import 'server-only'
import { createHash } from 'node:crypto'
import { link, mkdir, open, readdir, readFile, rm, stat, statfs, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { UPLOAD_CHUNK_BYTES, checkServerUpload, looksLikeVideo, videoFileName } from '../upload'

// UPLOADS TO OUR OWN VIDEO SERVER. The app and nginx share one folder: <root>/<academy slug>/. Pieces are collected in
// <slug>/.uploads/ (nginx is never asked to sign a hidden path) and the finished file is moved beside the others.
// Callers check the person's rights first; every function here is scoped to one academy's folder.

/** The shared video folder as this app sees it, or null when uploading from the dashboard is not set up. */
export function videoUploadDirFromEnv(env: Record<string, string | undefined> = process.env): string | null {
  const dir = env.VIDEO_UPLOAD_DIR?.trim()
  return dir && path.isAbsolute(dir) ? dir : null
}

export type UploadError = 'bad_request' | 'not_found' | 'no_space' | 'not_a_video' | 'incomplete'
export class UploadFailed extends Error {
  constructor(public code: UploadError) { super(code) }
}

export interface UploadMeta { lessonId: string; memberId: string; name: string; size: number; finalPath?: string }

const ID = /^[0-9a-f]{32}$/
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/
/** Left free on the disk, so a big upload cannot fill the server the app itself runs on. */
const RESERVE_BYTES = 2 * 1024 * 1024 * 1024
const STALE_MS = 2 * 24 * 60 * 60 * 1000

function folders(root: string, slug: string) {
  if (!SLUG.test(slug)) throw new UploadFailed('bad_request')
  // The folder is only known when the app runs: keep the bundler from tracing the project for it.
  const home = path.join(/*turbopackIgnore: true*/ root, slug)
  return { home, parts: path.join(/*turbopackIgnore: true*/ home, '.uploads') }
}
function files(root: string, slug: string, id: string) {
  if (!ID.test(id)) throw new UploadFailed('bad_request')
  const { home, parts } = folders(root, slug)
  return { home, part: path.join(/*turbopackIgnore: true*/ parts, `${id}.part`), meta: path.join(/*turbopackIgnore: true*/ parts, `${id}.json`) }
}
const sizeOf = (file: string) => stat(file).then((s) => s.size, () => 0)

async function readMeta(file: string, memberId: string): Promise<UploadMeta> {
  const meta = await readFile(file, 'utf8').then((s) => JSON.parse(s) as UploadMeta, () => null)
  if (!meta || meta.memberId !== memberId) throw new UploadFailed('not_found')
  return meta
}

/** Drops half-finished uploads nobody has touched for two days. */
async function sweep(parts: string, now: number) {
  for (const name of await readdir(parts).catch(() => [] as string[])) {
    if (!name.endsWith('.json')) continue
    const meta = path.join(/*turbopackIgnore: true*/ parts, name)
    const part = meta.replace(/\.json$/, '.part')
    const touched = await stat(part).catch(() => stat(meta)).then((s) => s.mtimeMs, () => now)
    if (now - touched > STALE_MS) await Promise.all([rm(part, { force: true }), rm(meta, { force: true })])
  }
}

/**
 * Begins an upload, or picks up the same one again: choosing the same file for the same lesson continues where it
 * stopped, even after the page was closed.
 */
export async function startUpload(root: string, slug: string, input: Omit<UploadMeta, 'finalPath'> & { modified: number }): Promise<{ id: string; received: number }> {
  const check = checkServerUpload(input.name, input.size)
  if (!check.ok) throw new UploadFailed('bad_request')
  const id = createHash('sha256').update(JSON.stringify([input.memberId, input.lessonId, input.name, input.size, input.modified])).digest('hex').slice(0, 32)
  const f = files(root, slug, id)
  const { parts } = folders(root, slug)
  await mkdir(parts, { recursive: true, mode: 0o755 })
  await sweep(parts, Date.now())

  const old = await readFile(f.meta, 'utf8').then((s) => JSON.parse(s) as UploadMeta, () => null)
  // A finished upload that was already moved into place starts over, so the lesson gets a real file again.
  const received = old && !old.finalPath ? await sizeOf(f.part) : 0
  const disk = await statfs(parts)
  if (disk.bavail * disk.bsize < input.size - received + RESERVE_BYTES) throw new UploadFailed('no_space')
  if (!old || old.finalPath) {
    await writeFile(f.part, new Uint8Array(0), { mode: 0o644 })
    await writeFile(f.meta, JSON.stringify({ lessonId: input.lessonId, memberId: input.memberId, name: input.name, size: input.size } satisfies UploadMeta))
  }
  return { id, received }
}

/**
 * Adds one piece. `offset` must be where the file ends now; otherwise nothing is written and the caller is told where
 * to continue from (a piece that arrived but whose answer was lost is simply skipped).
 */
export async function appendChunk(root: string, slug: string, id: string, memberId: string, offset: number, data: Uint8Array): Promise<{ ok: boolean; received: number }> {
  const f = files(root, slug, id)
  const meta = await readMeta(f.meta, memberId)
  if (!data.length || data.length > UPLOAD_CHUNK_BYTES) throw new UploadFailed('bad_request')
  const received = await sizeOf(f.part)
  if (offset !== received) return { ok: false, received }
  if (offset + data.length > meta.size) throw new UploadFailed('bad_request')
  const handle = await open(f.part, 'r+')
  try {
    let written = 0
    while (written < data.length) written += (await handle.write(data, written, data.length - written, offset + written)).bytesWritten
  } finally {
    await handle.close()
  }
  return { ok: true, received: offset + data.length }
}

/** Checks the whole file arrived and is a video, then moves it into the academy's folder without replacing any file. */
export async function finishUpload(root: string, slug: string, id: string, memberId: string): Promise<UploadMeta & { path: string }> {
  const f = files(root, slug, id)
  const meta = await readMeta(f.meta, memberId)
  // Asked twice (the first answer was lost): the file is already in place.
  if (meta.finalPath && await sizeOf(path.join(/*turbopackIgnore: true*/ f.home, meta.finalPath)) === meta.size) return { ...meta, path: meta.finalPath }
  const check = checkServerUpload(meta.name, meta.size)
  if (!check.ok || await sizeOf(f.part) !== meta.size) throw new UploadFailed('incomplete')

  const handle = await open(f.part, 'r')
  const head = new Uint8Array(12)
  try { await handle.read(head, 0, head.length, 0) } finally { await handle.close() }
  if (!looksLikeVideo(head, check.ext)) {
    await discardUpload(root, slug, id)
    throw new UploadFailed('not_a_video')
  }

  const wanted = videoFileName(meta.name, check.ext)
  for (let n = 1; n <= 200; n++) {
    const name = n === 1 ? wanted : wanted.replace(/(\.[a-z0-9]+)$/, ` (${n})$1`)
    try {
      await link(f.part, path.join(/*turbopackIgnore: true*/ f.home, name)) // fails if the name is taken, unlike a rename
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') continue
      throw e
    }
    await writeFile(f.meta, JSON.stringify({ ...meta, finalPath: name } satisfies UploadMeta))
    await rm(f.part, { force: true })
    return { ...meta, path: name }
  }
  throw new UploadFailed('bad_request')
}

/** Forgets an upload. Never touches a finished file in the academy's folder. */
export async function discardUpload(root: string, slug: string, id: string): Promise<void> {
  const f = files(root, slug, id)
  await Promise.all([rm(f.part, { force: true }), rm(f.meta, { force: true })])
}

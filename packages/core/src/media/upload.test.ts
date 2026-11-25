import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { appendChunk, discardUpload, finishUpload, startUpload, videoUploadDirFromEnv } = await import('./privileged/uploads')
const { MAX_SERVER_VIDEO_BYTES, UPLOAD_CHUNK_BYTES, checkServerUpload, looksLikeVideo, titleFromFileName, videoFileName } = await import('./upload')
const { serverVideoPath } = await import('./server-video')

/** A tiny file that starts like an MP4. */
const mp4 = (size: number) => {
  const b = new Uint8Array(size).fill(7)
  b.set([0, 0, 0, 24, ...Buffer.from('ftypisom')], 0)
  return b
}

describe('upload rules', () => {
  it('allows mp4 and webm up to the limit', () => {
    expect(checkServerUpload('a.MP4', 10)).toEqual({ ok: true, ext: 'mp4' })
    expect(checkServerUpload('a.mov', 10)).toMatchObject({ reason: 'type' })
    expect(checkServerUpload('a.mp4', 0)).toMatchObject({ reason: 'empty' })
    expect(checkServerUpload('a.mp4', MAX_SERVER_VIDEO_BYTES + 1)).toMatchObject({ reason: 'size' })
  })
  it.each(['Session 6 - Virtual Network.mp4', '../../etc/passwd.mp4', '.hidden.mp4', 'a/b\\c:d*e?.mp4', '   .mp4', `${'x'.repeat(400)}.mp4`])(
    'makes a name the player accepts from %j', (name) => expect(serverVideoPath(videoFileName(name, 'mp4'))).not.toBeNull())
  it('keeps the person’s own name and suggests a title', () => {
    expect(videoFileName('Session 6 - Virtual Network.MP4', 'mp4')).toBe('Session 6 - Virtual Network.mp4')
    expect(titleFromFileName('Session_6 - Virtual Network.mp4')).toBe('Session 6 - Virtual Network')
    expect(titleFromFileName('a.mp4')).toBe('New video')
  })
  it('reads the first bytes', () => {
    expect(looksLikeVideo(mp4(16), 'mp4')).toBe(true)
    expect(looksLikeVideo(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), 'webm')).toBe(true)
    expect(looksLikeVideo(Buffer.from('<html><body>'), 'mp4')).toBe(false)
  })
  it('needs an absolute folder', () => {
    expect(videoUploadDirFromEnv({ VIDEO_UPLOAD_DIR: '/videos' })).toBe('/videos')
    expect(videoUploadDirFromEnv({ VIDEO_UPLOAD_DIR: 'videos' })).toBeNull()
    expect(videoUploadDirFromEnv({})).toBeNull()
  })
})

describe('uploading in pieces', () => {
  let root = ''
  beforeAll(async () => { root = await mkdtemp(path.join(tmpdir(), 'vid-')) })
  afterAll(() => rm(root, { recursive: true, force: true }))
  const data = mp4(UPLOAD_CHUNK_BYTES + 1000)
  const input = { lessonId: 'l1', memberId: 'm1', name: 'Class 1.mp4', size: data.length, modified: 1 }

  it('collects the pieces, resumes, and moves the finished file into the academy folder', async () => {
    const { id, received } = await startUpload(root, 'academy', input)
    expect(received).toBe(0)
    await appendChunk(root, 'academy', id, 'm1', 0, data.slice(0, UPLOAD_CHUNK_BYTES))
    // The same file again (page reloaded): continue from the second piece.
    expect(await startUpload(root, 'academy', input)).toEqual({ id, received: UPLOAD_CHUNK_BYTES })
    // A repeated piece writes nothing.
    expect(await appendChunk(root, 'academy', id, 'm1', 0, data.slice(0, 100))).toEqual({ ok: false, received: UPLOAD_CHUNK_BYTES })
    await expect(finishUpload(root, 'academy', id, 'm1')).rejects.toMatchObject({ code: 'incomplete' })
    await appendChunk(root, 'academy', id, 'm1', UPLOAD_CHUNK_BYTES, data.slice(UPLOAD_CHUNK_BYTES))
    const done = await finishUpload(root, 'academy', id, 'm1')
    expect(done).toMatchObject({ path: 'Class 1.mp4', lessonId: 'l1' })
    expect(Buffer.compare(await readFile(path.join(root, 'academy', done.path)), Buffer.from(data))).toBe(0)
    // Asked again: same answer, no second file.
    expect((await finishUpload(root, 'academy', id, 'm1')).path).toBe('Class 1.mp4')
  })

  it('never replaces a file that is already there', async () => {
    const small = mp4(64)
    const { id } = await startUpload(root, 'academy', { ...input, lessonId: 'l2', size: 64 })
    await appendChunk(root, 'academy', id, 'm1', 0, small)
    expect((await finishUpload(root, 'academy', id, 'm1')).path).toBe('Class 1 (2).mp4')
    expect((await readFile(path.join(root, 'academy', 'Class 1.mp4'))).length).toBe(data.length)
  })

  it('refuses other people, other academies, bad ids, oversize pieces and non-videos', async () => {
    const { id } = await startUpload(root, 'academy', { ...input, name: 'x.mp4', size: 20 })
    await expect(appendChunk(root, 'academy', id, 'someone-else', 0, mp4(20))).rejects.toMatchObject({ code: 'not_found' })
    await expect(appendChunk(root, 'other', id, 'm1', 0, mp4(20))).rejects.toMatchObject({ code: 'not_found' })
    await expect(appendChunk(root, 'academy', '../../x', 'm1', 0, mp4(20))).rejects.toMatchObject({ code: 'bad_request' })
    await expect(appendChunk(root, '..', id, 'm1', 0, mp4(20))).rejects.toMatchObject({ code: 'bad_request' })
    await expect(appendChunk(root, 'academy', id, 'm1', 0, mp4(21))).rejects.toMatchObject({ code: 'bad_request' })
    await appendChunk(root, 'academy', id, 'm1', 0, Buffer.from('<html>not a video'.padEnd(20)))
    await expect(finishUpload(root, 'academy', id, 'm1')).rejects.toMatchObject({ code: 'not_a_video' })
    await discardUpload(root, 'academy', id)
  })

  it('clears uploads abandoned for two days', async () => {
    const { id } = await startUpload(root, 'academy', { ...input, name: 'old.mp4', size: 20 })
    const part = path.join(root, 'academy', '.uploads', `${id}.part`)
    await writeFile(part, 'abc')
    const old = new Date(Date.now() - 3 * 24 * 3600 * 1000)
    await utimes(part, old, old)
    await startUpload(root, 'academy', { ...input, name: 'new.mp4', size: 20 })
    expect(await readdir(path.join(root, 'academy', '.uploads'))).not.toContain(`${id}.part`)
  })
})

import { describe, expect, it } from 'vitest'
import { serverVideoPath, signServerVideoUrl, videoServerFromEnv } from './server-video'
import { parseVideoSource } from './source'

const secret = 'a'.repeat(32)

describe('videoServerFromEnv', () => {
  it('needs an https origin and a long secret', () => {
    expect(videoServerFromEnv({ VIDEO_SERVER_URL: 'https://videos.example.com/', VIDEO_SERVER_SECRET: secret })).toEqual({ url: 'https://videos.example.com', secret })
    expect(videoServerFromEnv({})).toBeNull()
    expect(videoServerFromEnv({ VIDEO_SERVER_URL: 'http://videos.example.com', VIDEO_SERVER_SECRET: secret })).toBeNull()
    expect(videoServerFromEnv({ VIDEO_SERVER_URL: 'https://example.com/videos', VIDEO_SERVER_SECRET: secret })).toBeNull()
    expect(videoServerFromEnv({ VIDEO_SERVER_URL: 'https://videos.example.com', VIDEO_SERVER_SECRET: 'short' })).toBeNull()
  })
})

describe('serverVideoPath', () => {
  it.each(['lesson-01.mp4', 'month-1/Class 2 (FinOps).MP4', 'a/b/c.webm'])('accepts %s', (p) => expect(serverVideoPath(p)).toBe(p))
  it('drops a leading slash', () => expect(serverVideoPath('/lesson.mp4')).toBe('lesson.mp4'))
  it.each(['', '../other/x.mp4', 'a/../../x.mp4', './x.mp4', 'a//x.mp4', '.hidden.mp4', 'x.mov', 'x.mp4/', 'a\\x.mp4', 'a\nb.mp4'])(
    'rejects %j', (p) => expect(serverVideoPath(p)).toBeNull())
  it('is a video source', () => {
    expect(parseVideoSource('server', 'month-1/a.mp4')).toEqual({ provider: 'self_hosted', path: 'month-1/a.mp4' })
    expect(parseVideoSource('server', '../a.mp4')).toBeNull()
  })
})

describe('signServerVideoUrl', () => {
  const server = { url: 'https://videos.example.com', secret: 'test-secret-0123456789' }
  // Expected value made with the command nginx documents:
  //   printf '%s' '1000/cloudcadre/lesson-01.mp4 test-secret-0123456789' | openssl md5 -binary | openssl base64 | tr '+/' '-_' | tr -d '='
  it('matches openssl and expires after the ttl', () => {
    expect(signServerVideoUrl(server, 'cloudcadre', 'lesson-01.mp4', { now: 900, ttlSeconds: 100 }))
      .toBe('https://videos.example.com/cloudcadre/lesson-01.mp4?md5=xSqAJnfhz6PtloG0nE0sbg&expires=1000')
  })
  it('encodes the address but signs the decoded path', () => {
    const url = new URL(signServerVideoUrl(server, 'cloudcadre', 'm 1/50% #2?.mp4', { now: 0 }))
    expect(url.pathname).toBe('/cloudcadre/m%201/50%25%20%232%3F.mp4')
    expect(url.searchParams.get('expires')).toBe('14400')
  })
})

import { generateKeyPairSync, createVerify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseVideoSource, youtubeId } from './source'
import { signMuxToken } from './mux'

describe('youtubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s', (input, id) => expect(youtubeId(input)).toBe(id))

  it.each([
    'http://youtube.com/watch?v=dQw4w9WgXcQ',                 // not https
    'https://evil.example/watch?v=dQw4w9WgXcQ',               // wrong host
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',   // look-alike host
    'https://www.youtube.com/watch?v="><script>alert(1)',     // not an id
    'javascript:alert(1)',
    '',
  ])('rejects %s', (input) => expect(youtubeId(input)).toBeNull())
})

describe('parseVideoSource', () => {
  it('accepts direct https video files and streams only', () => {
    expect(parseVideoSource('url', 'https://cdn.example.com/a/b.mp4')).toEqual({ provider: 'external_url', url: 'https://cdn.example.com/a/b.mp4' })
    expect(parseVideoSource('url', 'https://cdn.example.com/a/b.m3u8')).not.toBeNull()
    expect(parseVideoSource('url', 'http://cdn.example.com/b.mp4')).toBeNull()
    expect(parseVideoSource('url', 'https://user:pw@cdn.example.com/b.mp4')).toBeNull()
    expect(parseVideoSource('url', 'https://cdn.example.com/page.html')).toBeNull()
    expect(parseVideoSource('url', 'javascript:alert(1)//.mp4')).toBeNull()
  })
  it('validates mux playback ids', () => {
    expect(parseVideoSource('mux', 'a1B2c3D4e5F6')).toEqual({ provider: 'mux', playbackId: 'a1B2c3D4e5F6' })
    expect(parseVideoSource('mux', 'abc')).toBeNull()
    expect(parseVideoSource('mux', 'abc/../../x')).toBeNull()
  })
  it('rejects unknown kinds', () => expect(parseVideoSource('vimeo', 'https://vimeo.com/1')).toBeNull())
})

describe('signMuxToken', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const signing = { keyId: 'key123', privateKeyBase64: Buffer.from(pem).toString('base64') }

  it('produces an RS256 JWT that verifies against the public key', () => {
    const jwt = signMuxToken('playback1', signing, { now: 1_000, ttlSeconds: 60 })
    const [h, c, s] = jwt.split('.') as [string, string, string]
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT', kid: 'key123' })
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({ sub: 'playback1', aud: 'v', exp: 1_060, kid: 'key123' })
    expect(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true)
  })
})

import { createSign } from 'node:crypto'

// Mux signed playback: an RS256 JWT whose subject is the playback id. The private key is the "signing key"
// from the Mux dashboard (base64-encoded PEM), kept in env, never in the database or the browser.
// https://www.mux.com/docs/guides/secure-video-playback

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export interface MuxSigning { keyId: string; privateKeyBase64: string }

export function muxSigningFromEnv(env: NodeJS.ProcessEnv = process.env): MuxSigning | null {
  const keyId = env.MUX_SIGNING_KEY_ID
  const privateKeyBase64 = env.MUX_SIGNING_PRIVATE_KEY
  return keyId && privateKeyBase64 ? { keyId, privateKeyBase64 } : null
}

/** `aud`: "v" = video stream, "t" = thumbnail. Default lifetime is short: the player asks again on reload. */
export function signMuxToken(
  playbackId: string, signing: MuxSigning, opts: { audience?: 'v' | 't'; ttlSeconds?: number; now?: number } = {},
): string {
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: signing.keyId }))
  const claims = b64url(JSON.stringify({ sub: playbackId, aud: opts.audience ?? 'v', exp: now + (opts.ttlSeconds ?? 4 * 3600), kid: signing.keyId }))
  const pem = Buffer.from(signing.privateKeyBase64, 'base64').toString('utf8')
  const sig = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(pem)
  return `${header}.${claims}.${b64url(sig)}`
}

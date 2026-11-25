import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'
import { PROOF_EXTS, PROOF_MAX_BYTES, sniffProof, type ProofKind } from '../upi'

// PAYMENT SCREENSHOTS. They sit in the private `payment-proofs` bucket under {tenant}/{member}/. The learner uploads
// straight from the browser through a one-time URL; the server then reads the file back and decides by its CONTENT
// (not its name or the browser's claim) whether it is a picture or PDF at all. Staff read it through a link that works
// for one minute. Nothing here is ever public.

const BUCKET = 'payment-proofs'
const db = () => createPrivilegedDb(getPlane(null))
const folder = (tenantId: string, memberId: string) => `${tenantId}/${memberId}`

export interface ProofTarget { path: string; token: string; signedUrl: string }

export async function createProofTarget(tenantId: string, memberId: string, ext: string): Promise<ProofTarget> {
  if (!(PROOF_EXTS as readonly string[]).includes(ext)) throw new Error('unsupported file type')
  const path = `${folder(tenantId, memberId)}/${randomUUID()}.${ext}`
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) throw new Error(`upload url failed: ${error?.message}`)
  return { path, token: data.token, signedUrl: data.signedUrl }
}

/** What really arrived: reads the file back and looks at its first bytes. Null when it is missing, too big or not a picture or PDF. */
export async function inspectProof(tenantId: string, memberId: string, path: string): Promise<{ size: number; kind: ProofKind } | null> {
  const prefix = folder(tenantId, memberId)
  if (!path.startsWith(`${prefix}/`) || path.slice(prefix.length + 1).includes('/') || path.includes('..')) return null
  const { data, error } = await db().storage.from(BUCKET).download(path)
  if (error || !data) return null
  if (data.size <= 0 || data.size > PROOF_MAX_BYTES) return null
  const head = new Uint8Array(await data.slice(0, 16).arrayBuffer())
  const kind = sniffProof(head)
  return kind ? { size: data.size, kind } : null
}

export async function removeProof(path: string): Promise<void> {
  await db().storage.from(BUCKET).remove([path])
}

/** A link that works for one minute, for the staff member who is reviewing the payment. */
export async function signedProofUrl(path: string): Promise<string | null> {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, 60)
  return error || !data ? null : data.signedUrl
}

import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page } from '@playwright/test'

const MAIL_LOG = process.env.SMTP_SINK_LOG ?? '/tmp/educore-mail.log'

const mailsTo = (email: string) => {
  let log = ''
  try { log = readFileSync(MAIL_LOG, 'utf8') } catch { /* no mail captured yet */ }
  return log.split('----').filter((p) => p.includes(`to=${email}`))
}

export const PASSWORD = 'e2e-password-1'

/** Test setup only: the account exists with the test password (creates it, or resets it for an existing user). */
export async function ensureUser(email: string) {
  const { base, headers } = authAdmin()
  const user = await findUser(email)
  const body = JSON.stringify(user ? { password: PASSWORD } : { email, password: PASSWORD, email_confirm: true })
  const res = await fetch(`${base}/auth/v1/admin/users${user ? `/${user.id}` : ''}`, { method: user ? 'PUT' : 'POST', headers, body })
  if (!res.ok) throw new Error(`could not prepare user ${email}: ${res.status} ${await res.text()}`)
}

/** Signs in through the real login page. */
export async function signIn(page: Page, email: string, next = '/') {
  await ensureUser(email)
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => u.pathname === next)
}

// ---------------------------------------------------------------------------- two-step (TOTP)

/** RFC 6238 (SHA-1, 6 digits, 30 s). `atMs` lets a test ask for a neighbouring time step. */
export function totp(base32Secret: string, atMs = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of base32Secret.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / 30)))
  const h = createHmac('sha1', key).update(counter).digest()
  const o = h[h.length - 1]! & 0xf
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!
  return String(n % 1_000_000).padStart(6, '0')
}

function localEnv(name: string): string {
  const file = readFileSync(join(process.cwd(), 'apps/academy/.env.local'), 'utf8') // Playwright runs from the repo root
  const m = file.match(new RegExp(`^${name}=(.*)$`, 'm'))
  if (!m) throw new Error(`${name} missing from apps/academy/.env.local`)
  return m[1]!.trim()
}

function authAdmin() {
  const base = localEnv('SUPABASE_URL')
  const key = localEnv('SUPABASE_SECRET_KEY')
  return { base, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
}

async function findUser(email: string) {
  const { base, headers } = authAdmin()
  const list = (await (await fetch(`${base}/auth/v1/admin/users?per_page=1000`, { headers })).json()) as { users: { id: string; email: string }[] }
  return list.users.find((u) => u.email === email)
}

/** Test setup only: removes every authenticator factor of a user through the Auth admin API, so a run can enrol again. */
export async function resetMfa(email: string) {
  const { base, headers } = authAdmin()
  const user = await findUser(email)
  if (!user) return
  const factors = (await (await fetch(`${base}/auth/v1/admin/users/${user.id}/factors`, { headers })).json()) as { id: string }[]
  for (const f of Array.isArray(factors) ? factors : []) await fetch(`${base}/auth/v1/admin/users/${user.id}/factors/${f.id}`, { method: 'DELETE', headers })
}

/** Enrols an authenticator app for the signed-in staff member and returns its key. Run `resetMfa` first. */
export async function enableMfa(page: Page, secretOut: { current?: string } = {}): Promise<string> {
  await page.goto('/admin/security')
  await page.getByRole('button', { name: 'Set up authenticator app' }).click()
  const secret = (await page.getByTestId('totp-secret').innerText()).trim()
  const left = 30_000 - (Date.now() % 30_000)
  if (left < 4_000) await page.waitForTimeout(left + 500)
  await page.getByLabel('Code').fill(totp(secret))
  await page.getByRole('button', { name: 'Turn on two-step check' }).click()
  await page.waitForURL('**/admin')
  secretOut.current = secret
  return secret
}

// ---------------------------------------------------------------------------- owner shortcuts

/** A fresh sign-in as the owner with the two-step check done in this same browser context (each test gets its own). */
export async function ownerWithMfa(page: Page, owner: string, next = '/admin') {
  await resetMfa(owner)
  await signIn(page, owner, next)
  const secret = await enableMfa(page)
  if (next !== '/admin') await page.goto(next)
  return secret
}

/** Creates a published course with one reading lesson and a price (₹, GST included). Owner must be at aal2. */
export async function createPaidCourse(page: Page, title: string, priceRupees: string) {
  await page.goto('/admin/courses')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create draft' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByLabel('New section').fill('Start here')
  await page.getByRole('button', { name: 'Add section' }).click()
  await expect(page.getByRole('heading', { name: /Start here/ })).toBeVisible()
  await page.getByLabel('Lesson title').fill('First reading')
  await page.getByLabel('Type').selectOption({ label: 'Reading' })
  await page.getByRole('button', { name: 'Add lesson' }).click()
  await expect(page.getByRole('link', { name: 'First reading' })).toBeVisible()
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published', { exact: true })).toBeVisible()
  await page.getByLabel('Price (₹)', { exact: true }).fill(priceRupees)
  await page.getByRole('button', { name: 'Start selling' }).click()
  await expect(page.getByText('This course is for sale.')).toBeVisible()
}

// ---------------------------------------------------------------------------- mail

/** Waits until the local mail sink has captured a mail to `email` whose text contains `needle`; returns that mail. */
export async function waitForMail(email: string, needle: string, timeoutMs = 20_000): Promise<string> {
  const start = Date.now()
  for (;;) {
    const hit = mailsTo(email).find((m) => m.includes(needle))
    if (hit) return hit
    if (Date.now() - start > timeoutMs) throw new Error(`no mail to ${email} containing "${needle}"`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

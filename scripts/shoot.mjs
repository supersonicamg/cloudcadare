#!/usr/bin/env node
// Screenshot helper for checking built screens against the mockups, on the local stack.
//   node scripts/shoot.mjs [--base http://cloudcadre.localhost:3100] [--as owner|learner|visitor] [--mobile] [--out DIR] /admin /admin/courses ...
// Prints "<status> <path> <title> [console errors]" per page and writes DIR/<path>.png (DIR defaults to $CLAUDE_JOB_DIR/tmp/shots or /tmp/shots).
//
// Sign-in uses the local mail sink and (for owner) the authenticator step, then caches the browser session in
// .shoot-state/<as>.json so later runs and parallel agents reuse it. Never delete another user's factors from here.
// Delete .shoot-state/ to force a fresh sign-in. Needs: local Supabase, mail sink (pnpm mail:sink), a running `next dev`.
import { chromium } from '@playwright/test'
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v }
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true }
const base = opt('--base', process.env.E2E_BASE_URL ?? 'http://cloudcadre.localhost:3100')
const as = opt('--as', 'owner')
const mobile = flag('--mobile')
const out = opt('--out', join(process.env.CLAUDE_JOB_DIR ? join(process.env.CLAUDE_JOB_DIR, 'tmp') : '/tmp', 'shots'))
const full = !flag('--viewport')
const paths = args
mkdirSync(out, { recursive: true })

const root = new URL('..', import.meta.url).pathname
const STATE_DIR = join(root, '.shoot-state')
mkdirSync(STATE_DIR, { recursive: true })
const MAIL_LOG = process.env.SMTP_SINK_LOG ?? '/tmp/educore-mail.log'
const EMAIL = { owner: 'founder@example.com', learner: 'shoot-learner@example.com' }[as]

const mailsTo = (email) => {
  let log = ''
  try { log = readFileSync(MAIL_LOG, 'utf8') } catch {}
  return log.split('----').filter((p) => p.includes(`to=${email}`))
}
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of secret.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)))
  const h = createHmac('sha1', key).update(counter).digest()
  const o = h[h.length - 1] & 0xf
  return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0')
}
const env = (name) => readFileSync(join(root, 'apps/academy/.env.local'), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))[1].trim()
async function resetOwnerFactors() {
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SECRET_KEY'), h = { apikey: key, Authorization: `Bearer ${key}` }
  const { users } = await (await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers: h })).json()
  const u = users.find((x) => x.email === EMAIL)
  if (!u) return
  const factors = await (await fetch(`${url}/auth/v1/admin/users/${u.id}/factors`, { headers: h })).json()
  for (const f of Array.isArray(factors) ? factors : []) await fetch(`${url}/auth/v1/admin/users/${u.id}/factors/${f.id}`, { method: 'DELETE', headers: h })
}

async function signIn(page) {
  const before = mailsTo(EMAIL).length
  await page.goto(`${base}/login?next=/`)
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()
  for (let i = 0; i < 40 && mailsTo(EMAIL).length <= before; i++) await page.waitForTimeout(500)
  const code = mailsTo(EMAIL).at(-1).match(/>(\d{6})</)[1]
  await page.getByLabel('Code').fill(code)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => u.pathname === '/')
}
async function stepUp(page) {
  await resetOwnerFactors()
  await page.goto(`${base}/admin/security`)
  await page.getByRole('button', { name: 'Set up authenticator app' }).click()
  const secret = (await page.getByTestId('totp-secret').innerText()).trim()
  const left = 30_000 - (Date.now() % 30_000)
  if (left < 4_000) await page.waitForTimeout(left + 500)
  await page.getByLabel('Code').fill(totp(secret))
  await page.getByRole('button', { name: 'Turn on two-step check' }).click()
  await page.waitForURL('**/admin')
}

const browser = await chromium.launch()
const stateFile = join(STATE_DIR, `${as}.json`)
const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }
let ctx = await browser.newContext({ viewport, storageState: existsSync(stateFile) ? stateFile : undefined })
let page = await ctx.newPage()
if (as !== 'visitor') {
  await page.goto(`${base}/${as === 'owner' ? 'admin' : 'learn'}`)
  const ok = as === 'owner' ? new URL(page.url()).pathname.startsWith('/admin') && !new URL(page.url()).pathname.startsWith('/admin/mfa') : !page.url().includes('/login')
  if (!ok) {
    await ctx.close()
    ctx = await browser.newContext({ viewport })
    page = await ctx.newPage()
    await signIn(page)
    if (as === 'owner') await stepUp(page)
    await ctx.storageState({ path: stateFile })
  }
}
for (const p of paths) {
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  const res = await page.goto(base + p, { waitUntil: 'networkidle' }).catch((e) => ({ status: () => 'ERR ' + e.message.slice(0, 80) }))
  const file = join(out, (p === '/' ? 'home' : p.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '_')) + (mobile ? '.m' : '') + '.png')
  await page.screenshot({ path: file, fullPage: full })
  console.log(`${res.status()} ${p} "${await page.title()}" -> ${file}${errors.length ? ' | console: ' + errors.join(' ; ') : ''}`)
  page.removeAllListeners('console'); page.removeAllListeners('pageerror')
}
await browser.close()

#!/usr/bin/env node
// Screenshot and check helper for built screens, against a running `next dev` (plan/14: cloud dev project, no mail sink).
//   node scripts/shoot.mjs [--base http://cloudcadre.localhost:3100] [--as learner|visitor] [--mobile] [--out DIR] [--viewport] /account /learn ...
// Per page it prints: status, path, title, sideways overflow (px), tap targets under 44px (phone only), console errors;
// and writes DIR/<path>.png (DIR defaults to $CLAUDE_JOB_DIR/tmp/shots or /tmp/shots).
//
// `--as learner` uses a throwaway account on the DEV project (shoot-learner@example.com). It is created through the Auth admin API
// (email pre-confirmed, known password), signed in through the real /login form so the academy membership is created exactly
// as for a real learner, and the browser session is cached in .shoot-state/learner.json. Delete that folder to start fresh.
// Never point this at a client's project.
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v }
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true }
const base = opt('--base', process.env.E2E_BASE_URL ?? 'http://cloudcadre.localhost:3100')
const as = opt('--as', 'learner')
const mobile = flag('--mobile')
const out = opt('--out', join(process.env.CLAUDE_JOB_DIR ? join(process.env.CLAUDE_JOB_DIR, 'tmp') : '/tmp', 'shots'))
const full = !flag('--viewport')
// Preview CloudCadre's plan/15 §4 colours (bg #FFFFFF, muted #F2F2EF) in the browser only, without touching tenant_branding.
const brandTokens = flag('--brand-tokens')
const paths = args
mkdirSync(out, { recursive: true })

const root = new URL('..', import.meta.url).pathname
const STATE_DIR = join(root, '.shoot-state')
mkdirSync(STATE_DIR, { recursive: true })
const STATE = join(STATE_DIR, `${as}.json`)
const EMAIL = 'shoot-learner@example.com'
const PASSWORD = 'Shoot-learner-2026'

const env = (name) => readFileSync(join(root, 'apps/academy/.env.local'), 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))[1].trim().replace(/^"|"$/g, '')

async function ensureUser() {
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SECRET_KEY')
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Shoot Learner', whatsapp: '+919876500001' } }),
  })
  if (!res.ok && res.status !== 422) throw new Error(`could not create the test user: ${res.status} ${await res.text()}`)
}

async function signIn(page) {
  await ensureUser()
  await page.goto(`${base}/login?next=/account`)
  await page.getByLabel('Email address').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => u.pathname.startsWith('/account'), { timeout: 60_000 })
}

const browser = await chromium.launch()
const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }
const ctxOpts = { viewport, deviceScaleFactor: 1, ...(mobile ? { hasTouch: true, isMobile: true } : {}) }
let context = await browser.newContext({ ...ctxOpts, ...(as !== 'visitor' && existsSync(STATE) ? { storageState: STATE } : {}) })
let page = await context.newPage()
if (as !== 'visitor') {
  await page.goto(`${base}/account`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  if (!new URL(page.url()).pathname.startsWith('/account')) {
    await signIn(page)
    await context.storageState({ path: STATE })
  }
}

for (const path of paths) {
  const errors = []
  const onErr = (m) => { if (m.type() === 'error' && !/unstable value .Date.now\(\)./.test(m.text())) errors.push(m.text().slice(0, 140)) }
  page.on('console', onErr)
  const res = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch((e) => ({ status: () => `ERR ${e.message.slice(0, 60)}` }))
  if (brandTokens) await page.addStyleTag({ content: ':root{--color-bg:#FFFFFF;--color-muted:#F2F2EF;--color-fg:#14201F;--color-border:#E2E3DF}' })
  await page.waitForTimeout(400)
  const m = await page.evaluate((isMobile) => {
    const de = document.documentElement
    const small = isMobile
      ? [...document.querySelectorAll('a, button, input, select, textarea, summary, [role="switch"]')]
          .filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[hidden], [inert]') && (r.height < 43.5 || r.width < 43.5) && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline') })
          .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim().slice(0, 24)}(${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)})`)
      : []
    return { overflow: de.scrollWidth - de.clientWidth, title: document.title, small }
  }, mobile)
  const file = join(out, `${path.replace(/^\//, '').replace(/[/?&=]+/g, '_') || 'home'}${mobile ? '.m' : ''}.png`)
  await page.screenshot({ path: file, fullPage: full })
  console.log(`${res.status?.() ?? res}  ${path}  "${m.title}"  overflow=${m.overflow}px${m.small.length ? `  small=${m.small.length}: ${m.small.slice(0, 6).join(' ')}` : ''}${errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''}  -> ${file}`)
  page.off('console', onErr)
}
await browser.close()

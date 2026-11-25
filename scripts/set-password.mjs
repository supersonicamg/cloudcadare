#!/usr/bin/env node
// For someone who forgot their password: there is no mail server to send a reset link, so this sets a new temporary
// one through the Auth admin API and prints it. Confirm who is asking (for example on their WhatsApp number) first.
//   node --env-file=apps/academy/.env.local scripts/set-password.mjs person@example.com
import { randomBytes } from 'node:crypto'

const email = process.argv[2]?.trim().toLowerCase()
const { SUPABASE_URL: base, SUPABASE_SECRET_KEY: key } = process.env
if (!email || !base || !key) {
  console.error('Usage: node --env-file=apps/academy/.env.local scripts/set-password.mjs person@example.com')
  process.exit(1)
}

async function admin(path, init) {
  const res = await fetch(`${base}/auth/v1/admin/${path}`, {
    ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Auth admin API ${res.status}: ${await res.text()}`)
  return res.json()
}

async function findUser() {
  for (let page = 1; ; page++) {
    const { users } = await admin(`users?page=${page}&per_page=1000`)
    const hit = users.find((u) => u.email?.toLowerCase() === email)
    if (hit || users.length === 0) return hit
  }
}

const user = await findUser()
if (!user) {
  console.error(`No account with the email ${email} in ${new URL(base).host}.`)
  process.exit(1)
}
const password = randomBytes(12).toString('base64url')
await admin(`users/${user.id}`, { method: 'PUT', body: JSON.stringify({ password }) })
console.log(`Project:  ${new URL(base).host}\nAccount:  ${email}${user.user_metadata?.whatsapp ? `  (WhatsApp ${user.user_metadata.whatsapp})` : ''}\nPassword: ${password}`)

// Runs a SQL test file against the cloud DEV project (plan/14 §4) inside a transaction that is ALWAYS rolled back,
// so a test can create users, members and orders freely and leaves nothing behind.
//   node scripts/db-test.mjs packages/db/tests/learner_flows_email.sql
// A test fails by raising an exception (`raise exception 'what went wrong'`); `raise notice 'ok: ...'` prints progress.
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../packages/db/package.json', import.meta.url))
const postgres = require('postgres')

let url = process.env.CONTROL_DATABASE_URL
if (!url) {
  const env = fs.readFileSync(new URL('../apps/console/.env.local', import.meta.url), 'utf8')
  url = env.match(/^CONTROL_DATABASE_URL=(.*)$/m)?.[1]?.replace(/^"|"$/g, '')
}
if (!url) throw new Error('CONTROL_DATABASE_URL is not set')

const file = process.argv[2]
if (!file) throw new Error('usage: node scripts/db-test.mjs <file.sql>')
const sql = postgres(url, { max: 1, connect_timeout: 15, onnotice: (n) => console.log(`  ${n.message}`) })
let failed = false
try {
  await sql.unsafe('begin')
  await sql.unsafe(fs.readFileSync(file, 'utf8'))
  console.log(`PASSED ${file}`)
} catch (e) {
  failed = true
  console.error(`FAILED ${file}: ${e.message}`)
} finally {
  await sql.unsafe('rollback').catch(() => {})
  await sql.end()
  if (failed) process.exitCode = 1
}

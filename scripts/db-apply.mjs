// Apply one migration file to the cloud project in CONTROL_DATABASE_URL and record it in supabase_migrations,
// the same bookkeeping `supabase db push` does (plan/14 §2). Runs the file in one transaction.
//   node scripts/db-apply.mjs packages/db/supabase/migrations/20260101000027_a3_account.sql
//   node scripts/db-apply.mjs -q "select 1"            run a statement, print rows
// The URL comes from the environment or apps/console/.env.local. Use a DEV project only (plan/14 §4).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../packages/db/package.json', import.meta.url))
const postgres = require('postgres')

let url = process.env.CONTROL_DATABASE_URL
if (!url) {
  const env = fs.readFileSync(new URL('../apps/console/.env.local', import.meta.url), 'utf8')
  url = env.match(/^CONTROL_DATABASE_URL=(.*)$/m)?.[1]?.replace(/^"|"$/g, '')
}
if (!url) throw new Error('CONTROL_DATABASE_URL is not set')

const sql = postgres(url, { max: 1, connect_timeout: 15, onnotice: () => {} })
const [flag, arg] = process.argv.slice(2)
try {
  if (flag === '-q') {
    console.log(JSON.stringify(await sql.unsafe(arg), null, 1))
  } else {
    const file = flag
    const m = /^(\d{14})_(.+)\.sql$/.exec(path.basename(file))
    if (!m) throw new Error('file name must look like 20260101000027_name.sql')
    const [, version, name] = m
    const done = await sql`select 1 from supabase_migrations.schema_migrations where version = ${version}`
    if (done.length) {
      console.log(`already applied: ${version}`)
    } else {
      const body = fs.readFileSync(file, 'utf8')
      await sql.begin(async (tx) => {
        await tx.unsafe(body)
        await tx`insert into supabase_migrations.schema_migrations (version, name, statements) values (${version}, ${name}, ${[body]})`
      })
      console.log(`applied: ${version} ${name}`)
    }
  }
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await sql.end()
}

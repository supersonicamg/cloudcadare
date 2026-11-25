import 'server-only'
import postgres from 'postgres'

// The `control` schema is never exposed through the Data API (plan/03, 07), so the console and
// provisioning reach it with a direct, privileged Postgres connection from the server only.

let sql: postgres.Sql | undefined

export function getControlSql(): postgres.Sql {
  if (!sql) {
    const url = process.env.CONTROL_DATABASE_URL
    if (!url) throw new Error('Missing env CONTROL_DATABASE_URL')
    sql = postgres(url, { max: 5, idle_timeout: 20, prepare: false }) // prepare:false = pgbouncer-safe
  }
  return sql
}

export type { Sql, TransactionSql } from 'postgres'

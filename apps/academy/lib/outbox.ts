import 'server-only'
import { after } from 'next/server'
import { processOutbox } from '@educore/core/notifications'

/** Where an academy's pages live, for links inside emails. Dev: http://<slug>.localhost:3000. */
export function tenantOrigin(slug: string): string {
  const base = process.env.BASE_DOMAIN ?? 'localhost'
  if (base === 'localhost') return `http://${slug}.localhost:${process.env.PORT ?? '3000'}`
  return `https://${slug}.${base}`
}

/** Send what the last action queued (receipts, certificates) once the response is on its way. Never throws into the action. */
export function kickOutbox() {
  after(async () => {
    try { await processOutbox({ origin: tenantOrigin }) } catch (e) { console.error('outbox:', e instanceof Error ? e.message : e) }
  })
}

import type { DomainRecord } from './types'

// host → tenant routing record, read in proxy.ts. The proxy must stay fast and must never
// query Postgres (plan/02 §4), so the map lives in Upstash Redis, written by the console
// whenever a domain is verified, changed or a tenant is suspended.

export interface DomainMap {
  get(hostname: string): Promise<DomainRecord | null>
}

/** The write side, used by the console/workers whenever a tenant or domain changes. */
export interface WritableDomainMap extends DomainMap {
  set(hostname: string, record: DomainRecord): Promise<void>
  delete(hostname: string): Promise<void>
}

const key = (hostname: string) => `domain:${hostname}`

export class UpstashDomainMap implements WritableDomainMap {
  constructor(private readonly url: string, private readonly token: string) {}

  async get(hostname: string): Promise<DomainRecord | null> {
    const res = await fetch(`${this.url}/get/${encodeURIComponent(key(hostname))}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    })
    if (!res.ok) throw new Error(`domain map lookup failed: ${res.status}`)
    const { result } = (await res.json()) as { result: string | null }
    return result ? (JSON.parse(result) as DomainRecord) : null
  }

  async set(hostname: string, record: DomainRecord): Promise<void> {
    const res = await fetch(`${this.url}/set/${encodeURIComponent(key(hostname))}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(record),
    })
    if (!res.ok) throw new Error(`domain map write failed: ${res.status}`)
  }

  async delete(hostname: string): Promise<void> {
    await fetch(`${this.url}/del/${encodeURIComponent(key(hostname))}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
    })
  }
}

/** Development: EDUCORE_DOMAIN_MAP='{"learn.example.com":{"tenantId":"…","slug":"demo",…}}' */
export class EnvDomainMap implements DomainMap {
  private readonly map: Record<string, DomainRecord>
  constructor(json: string | undefined) {
    this.map = json ? (JSON.parse(json) as Record<string, DomainRecord>) : {}
  }
  async get(hostname: string) {
    return this.map[hostname] ?? null
  }
}

/** Writable map or null when Redis is not configured (development: nothing to write). */
export function writableDomainMapFromEnv(env: Record<string, string | undefined> = process.env): WritableDomainMap | null {
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? new UpstashDomainMap(url, token) : null
}

export function domainMapFromEnv(env: Record<string, string | undefined> = process.env): DomainMap {
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? new UpstashDomainMap(url, token) : new EnvDomainMap(env.EDUCORE_DOMAIN_MAP)
}

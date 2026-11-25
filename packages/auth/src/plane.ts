// A "plane" is the Supabase project that holds an academy's data. Phase 0 has one pooled plane,
// configured from env. Dedicated planes (Phase 4) resolve credentials per tenant here and nowhere else.

export interface Plane {
  id: string
  url: string
  publishableKey: string
}

function must(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export function getPlane(_planeId: string | null): Plane {
  // _planeId is ignored until dedicated planes exist; the signature is what callers depend on.
  return {
    id: 'pooled-1',
    url: must('SUPABASE_URL'),
    publishableKey: must('SUPABASE_PUBLISHABLE_KEY'),
  }
}

export function hasPlaneEnv(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY)
}

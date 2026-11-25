import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerDb, getPlane, hasPlaneEnv } from '@educore/auth'
import { getControlSql } from '@educore/db/control'

export const controlConfigured = () => Boolean(process.env.CONTROL_DATABASE_URL)

export async function getDb() {
  return createServerDb(getPlane(null), await cookies())
}

/** Verified user (JWT checked locally via getClaims) or null. */
export async function getUser() {
  if (!hasPlaneEnv()) return null
  const db = await getDb()
  const { data } = await db.auth.getClaims()
  const claims = data?.claims
  return claims ? { id: claims.sub, email: (claims.email as string | undefined) ?? null } : null
}

export async function requireUser(next: string) {
  const user = await getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  return user
}

export interface Staff {
  userId: string
  email: string | null
  distributorId: string
  distributorName: string
  role: 'owner' | 'admin' | 'sales' | 'support' | 'finance' | 'viewer'
}

/** Signed in AND an active member of a distributor. Re-checked on every request, never cached. */
export async function requireStaff(next: string): Promise<Staff> {
  const user = await requireUser(next)
  const sql = getControlSql()
  const [m] = await sql<{ distributor_id: string; name: string; role: Staff['role'] }[]>`
    select dm.distributor_id, d.name, dm.role
    from control.distributor_members dm join control.distributors d on d.id = dm.distributor_id
    where dm.user_id = ${user.id} and dm.status = 'active' and d.status = 'active'
    order by (d.kind = 'platform') desc limit 1`
  if (!m) redirect('/login?error=not_staff')
  return { userId: user.id, email: user.email, distributorId: m.distributor_id, distributorName: m.name, role: m.role }
}

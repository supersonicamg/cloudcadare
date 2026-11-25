import { requireUser } from '@/lib/session'
import { controlConfigured } from '@/lib/session'
import { NotConfigured } from '@/lib/not-configured'
import { RedeemForm } from './redeem-form'

export const metadata = { title: 'Redeem a license key' }

export default async function Start() {
  if (!controlConfigured()) return <NotConfigured />
  await requireUser('/start')
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Create your academy</h1>
      <p className="mt-2 mb-8 max-w-lg text-fg/70">Enter the license key you were given. Your academy is ready in a few seconds.</p>
      <RedeemForm baseDomain={process.env.BASE_DOMAIN ?? 'localhost'} />
    </>
  )
}

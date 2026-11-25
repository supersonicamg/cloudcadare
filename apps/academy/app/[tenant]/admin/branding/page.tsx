import { DEFAULT_COLORS, parseTokens } from '@educore/ui/tokens'
import { requireAccess } from '@/lib/dal'
import { BrandingForm } from './form'

export const metadata = { title: 'Branding' }

export default async function BrandingPage() {
  const a = await requireAccess({ permission: 'tenant.branding.manage', feature: 'core.branding' }, '/admin/branding')
  const { data } = await a.db.from('tenant_branding').select('display_name, tagline, tokens').eq('tenant_id', a.bundle.tenant.id).single()
  const colors = { ...DEFAULT_COLORS, ...parseTokens(data?.tokens).colors }
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Branding</h1>
      <p className="mt-2 mb-8 max-w-xl text-fg/70">Your name, tagline and colours. Logo upload comes with the media library.</p>
      <BrandingForm displayName={data?.display_name ?? a.bundle.tenant.name} tagline={data?.tagline ?? ''} primary={colors.primary} accent={colors.accent} />
    </>
  )
}

import { DEFAULT_COLORS, parseTokens } from '@educore/ui/tokens'
import { requireAccess } from '@/lib/dal'
import { BrandingForm } from './form'
import { pageTitle } from '@/lib/ui'

export const metadata = { title: 'Branding' }

export default async function BrandingPage() {
  const a = await requireAccess({ permission: 'tenant.branding.manage', feature: 'core.branding' }, '/admin/branding')
  const { data } = await a.db.from('tenant_branding').select('display_name, tagline, tokens').eq('tenant_id', a.bundle.tenant.id).single()
  const colors = { ...DEFAULT_COLORS, ...parseTokens(data?.tokens).colors }
  return (
    <>
      <h1 className={pageTitle}>Branding</h1>
      <p className="mt-2 mb-8 max-w-xl text-grey">Your name, tagline and colours. Logo upload comes with the media library.</p>
      <BrandingForm displayName={data?.display_name ?? a.bundle.tenant.name} tagline={data?.tagline ?? ''} primary={colors.primary} accent={colors.accent} />
    </>
  )
}

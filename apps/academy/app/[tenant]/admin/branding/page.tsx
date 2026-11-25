import { DEFAULT_COLORS, parseTokens } from '@educore/ui/tokens'
import { requireAccess } from '@/lib/dal'
import { BrandingForm } from './form'
import { Card, PageHeader } from '../_components/ui'

export const metadata = { title: 'Website look' }

export default async function BrandingPage() {
  const a = await requireAccess({ permission: 'tenant.branding.manage', feature: 'core.branding' }, '/admin/branding')
  const { data } = await a.db.from('tenant_branding').select('display_name, tagline, tokens').eq('tenant_id', a.bundle.tenant.id).single()
  const colors = { ...DEFAULT_COLORS, ...parseTokens(data?.tokens).colors }
  return (
    <>
      <PageHeader title="Website look" lead="Your academy’s name, one-line description and colours. Changing the logo is not possible here yet." />
      <Card><BrandingForm displayName={data?.display_name ?? a.bundle.tenant.name} tagline={data?.tagline ?? ''} primary={colors.primary} accent={colors.accent} /></Card>
    </>
  )
}

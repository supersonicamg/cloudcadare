import type { Branding } from '@educore/tenancy'
import type { BrandInfo } from '@educore/ui/theme'

const publicAssetUrl = (path: string | null) =>
  path && process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/storage/v1/object/public/public-assets/${path}` : null

export function brandInfo(b: Branding, platformName: string, year: number): BrandInfo {
  return {
    name: b.displayName,
    tagline: b.tagline,
    logoUrl: publicAssetUrl(b.logoPath),
    logoDarkUrl: publicAssetUrl(b.logoDarkPath),
    contact: b.contact,
    showPoweredBy: b.showPoweredBy,
    platformName,
    year,
  }
}

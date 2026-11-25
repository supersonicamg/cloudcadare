import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FeatureProvider } from '@educore/features/react'
import { PLACEHOLDER_SLUG } from '@educore/tenancy'
import { Sprite } from '@educore/ui/marks'
import { tokensToCss } from '@educore/ui/tokens'
import { getTenantBundle } from '@/lib/tenant'
import '../globals.css'

// The set of academies is unbounded and only known at request time, so the first render of each academy
// waits for its (cached) tenant bundle. After that, `use cache` serves it. Do not move this flag lower.
export const instant = false

// Cache Components requires at least one value for every root param. Real academies render on demand
// and are then cached; this one only lets `next build` prerender the shell.
export function generateStaticParams() {
  return [{ tenant: PLACEHOLDER_SLUG }]
}

export async function generateMetadata(): Promise<Metadata> {
  const b = await getTenantBundle()
  if (!b) return {}
  return {
    title: { default: b.branding.displayName, template: `%s · ${b.branding.displayName}` },
    description: b.branding.tagline ?? undefined,
  }
}

export default async function RootLayout({ children }: LayoutProps<'/[tenant]'>) {
  const bundle = await getTenantBundle()
  if (!bundle) notFound()

  return (
    <html lang={bundle.tenant.defaultLocale.split('-')[0]} className="h-full">
      <head>
        {/* Safe: tokensToCss only emits pattern-validated values. */}
        <style dangerouslySetInnerHTML={{ __html: tokensToCss(bundle.branding.tokens) }} />
      </head>
      <body className="min-h-full">
        <Sprite />
        <FeatureProvider snapshot={bundle.features}>{children}</FeatureProvider>
      </body>
    </html>
  )
}

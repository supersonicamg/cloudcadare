import type { Metadata } from 'next'
import { tokensToCss } from '@educore/ui/tokens'
import './globals.css'

// Every console page depends on env and the signed-in user: never prerender at build time.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: { default: 'EduCore Console', template: '%s · EduCore Console' } }

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokensToCss({}) }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}

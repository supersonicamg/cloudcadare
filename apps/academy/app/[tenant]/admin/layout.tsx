import { Schibsted_Grotesk } from 'next/font/google'
import { isEnabled } from '@educore/features'
import { can, requireAccess } from '@/lib/dal'
import { AdminNav, type NavItem } from './admin-nav'
import { canTeach, paymentPages, studentPages, waitingPayments } from './_components/sections'

export const metadata = { title: { default: 'Admin', template: '%s · Admin' } }

// Same family as the CloudCadre site, so staff and learners see one product.
const font = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-admin' })

export default async function AdminLayout({ children }: LayoutProps<'/[tenant]/admin'>) {
  // Any staff member may enter; each page then checks its own permission.
  const a = await requireAccess({ permission: 'member.view' }, '/admin')
  const waiting = await waitingPayments(a)
  const students = studentPages(a)
  const payments = paymentPages(a, waiting)
  const items: NavItem[] = [
    { href: '/admin', label: 'Home', icon: 'grid' as const },
    ...(canTeach(a) ? [{ href: '/admin/courses', label: 'Lessons and videos', icon: 'video' as const }] : []),
    ...(students[0] ? [{ href: students[0].href, label: 'Students', icon: 'user' as const, match: students.map((p) => p.href) }] : []),
    ...(payments[0] ? [{ href: payments[0].href, label: 'Payments', icon: 'briefcase' as const, match: payments.map((p) => p.href), badge: waiting }] : []),
    ...(isEnabled(a.bundle.features, 'learning.certificates') && can(a, 'certificate.manage') ? [{ href: '/admin/certificates', label: 'Certificates', icon: 'medal' as const }] : []),
    ...(can(a, 'tenant.branding.manage') ? [{ href: '/admin/branding', label: 'Website look', icon: 'image' as const }] : []),
    { href: '/admin/security', label: 'My security', icon: 'shield' as const },
  ]
  return (
    <div className={`${font.variable} flex min-h-screen flex-col bg-muted font-[family-name:var(--font-admin)] [--font-heading:var(--font-admin)] [--font-body:var(--font-admin)] lg:flex-row`}>
      <AdminNav items={items} brand={a.bundle.branding.displayName} who={a.memberName} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}

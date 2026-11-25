import { Schibsted_Grotesk } from 'next/font/google'
import { isEnabled } from '@educore/features'
import { can, holds, requireAccess } from '@/lib/dal'
import { AdminNav } from './admin-nav'

export const metadata = { title: { default: 'Admin', template: '%s · Admin' } }

// Same family as the CloudCadre site, so staff and learners see one product.
const font = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', variable: '--font-admin' })

export default async function AdminLayout({ children }: LayoutProps<'/[tenant]/admin'>) {
  // Any staff member may enter; each page then checks its own permission.
  const a = await requireAccess({ permission: 'member.view' }, '/admin')
  const f = a.bundle.features
  const items = [
    { href: '/admin', label: 'Overview', show: true },
    { href: '/admin/courses', label: 'Courses', show: isEnabled(f, 'catalog.courses') && (can(a, 'course.manage') || can(a, 'course.view_all')) },
    { href: '/admin/enrolments', label: 'Enrolments', show: isEnabled(f, 'catalog.courses') && holds(a, 'enrollment.manage') },
    { href: '/admin/learner-list', label: 'Learner list', show: isEnabled(f, 'catalog.courses') && holds(a, 'enrollment.manage') },
    { href: '/admin/orders', label: 'Orders', show: isEnabled(f, 'commerce.checkout') && can(a, 'order.view') },
    { href: '/admin/coupons', label: 'Coupons', show: isEnabled(f, 'commerce.coupons') && can(a, 'coupon.manage') },
    { href: '/admin/certificates', label: 'Certificates', show: isEnabled(f, 'learning.certificates') && can(a, 'certificate.manage') },
    { href: '/admin/payments', label: 'Payments', show: isEnabled(f, 'commerce.checkout') && holds(a, 'price.manage') },
    { href: '/admin/branding', label: 'Branding', show: can(a, 'tenant.branding.manage') },
    { href: '/admin/security', label: 'Security', show: true },
  ].filter((i) => i.show)
  return (
    <div className={`${font.variable} flex min-h-screen flex-col font-[family-name:var(--font-admin)] [--font-heading:var(--font-admin)] [--font-body:var(--font-admin)] lg:flex-row`}>
      <AdminNav
        items={items.map(({ href, label }) => ({ href, label }))}
        brand={a.bundle.branding.displayName}
        who={a.memberName}
        role={a.principal.aal === 'aal2' ? 'Two-step check on' : 'Signed in'}
      />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="max-w-5xl">{children}</div>
      </main>
    </div>
  )
}

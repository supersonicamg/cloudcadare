import Link from 'next/link'
import { isEnabled } from '@educore/features'
import { can, holds, requireAccess } from '@/lib/dal'

export const metadata = { title: { default: 'Admin', template: '%s · Admin' } }

export default async function AdminLayout({ children }: LayoutProps<'/[tenant]/admin'>) {
  // Any staff member may enter; each page then checks its own permission.
  const a = await requireAccess({ permission: 'member.view' }, '/admin')
  const items = [
    { href: '/admin', label: 'Overview', show: true },
    { href: '/admin/courses', label: 'Courses', show: isEnabled(a.bundle.features, 'catalog.courses') && (can(a, 'course.manage') || can(a, 'course.view_all')) },
    { href: '/admin/enrolments', label: 'Enrolments', show: isEnabled(a.bundle.features, 'catalog.courses') && holds(a, 'enrollment.manage') },
    { href: '/admin/certificates', label: 'Certificates', show: isEnabled(a.bundle.features, 'learning.certificates') && can(a, 'certificate.manage') },
    { href: '/admin/orders', label: 'Orders', show: isEnabled(a.bundle.features, 'commerce.checkout') && can(a, 'order.view') },
    { href: '/admin/coupons', label: 'Coupons', show: isEnabled(a.bundle.features, 'commerce.coupons') && can(a, 'coupon.manage') },
    { href: '/admin/payments', label: 'Payments', show: isEnabled(a.bundle.features, 'commerce.checkout') && holds(a, 'price.manage') },
    { href: '/admin/branding', label: 'Branding', show: can(a, 'tenant.branding.manage') },
    { href: '/admin/security', label: 'Security', show: true },
  ].filter((i) => i.show)
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <span className="font-semibold">{a.bundle.branding.displayName} <span className="font-normal text-fg/60">Admin</span></span>
          <span className="flex items-center gap-5 text-sm">
            <span className="text-fg/65">{a.memberName}</span>
            <Link href="/" className="text-primary underline-offset-2 hover:underline">View site</Link>
          </span>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-[12rem_1fr]">
        <nav aria-label="Admin" className="flex gap-4 text-[15px] md:flex-col md:gap-2">
          {items.map((i) => <Link key={i.href} href={i.href} className="text-fg/75 hover:text-fg">{i.label}</Link>)}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  )
}

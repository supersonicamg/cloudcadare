import Link from 'next/link'
import { getUser } from '@/lib/session'
import { NavLinks } from './nav-links'

// The working area. Each page still checks staff access itself (requireStaff); this shell only draws chrome.
export default async function StaffLayout({ children }: LayoutProps<'/'>) {
  const user = await getUser()
  return (
    <div className="grid min-h-screen md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-1 bg-fg px-3.5 py-5 text-white/75 md:sticky md:top-0 md:h-screen">
        <Link href="/" className="px-2.5 pb-5 text-xl font-bold tracking-tight text-white">EduCore</Link>
        <NavLinks />
        {user && (
          <p className="mt-auto hidden border-t border-white/15 px-3 pt-3.5 text-[13px] text-white/55 md:block">
            Signed in as<br /><span className="break-all">{user.email ?? 'staff'}</span>
          </p>
        )}
      </aside>
      <main className="min-w-0 px-5 py-8 md:px-10 md:py-11">{children}</main>
    </div>
  )
}

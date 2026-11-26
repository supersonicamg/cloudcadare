import Link from 'next/link'
import type { ReactNode } from 'react'
import { isEnabled } from '@educore/features'
import { getLeadCourseSlug } from '@/lib/learn'
import type { Access } from '@/lib/dal'
import type { getShell } from '@/lib/shell'
import { AccountMenu } from './account-menu'
import { Brand, waHref } from './v11-bars'
import { Ic, V11Frame, Wa, initialsOf, type IconName } from './v11'

/*
 * The learner's app frame (design guide v11, plan/mockups/app-v11.html). Every signed-in learning screen sits inside it,
 * so the four places a student goes are always in the same spot: links in the dark header on a laptop, a visible row of
 * four tabs under it on a tablet, a tab bar at the bottom of a phone. Never a hamburger.
 * Names are the plainest words: Home, My course, Live classes, My notes.
 */
export type LearnerTab = 'home' | 'lessons' | 'live' | 'notes'
/** A focus screen (a lesson, a quiz): a slim white bar with the way back, where you are, and how far along. */
export interface Focus { backHref: string; backLabel: string; where?: string; progress?: { pct: number; label: string } }
type Shell = Awaited<ReturnType<typeof getShell>>

export async function LearnerShell({ a, shell, active, focus, children }: { a: Access; shell: Shell; active: LearnerTab | null; wide?: boolean; focus?: Focus; children: ReactNode }) {
  const { brand, account, bundle } = shell
  const slug = await getLeadCourseSlug(a)
  const notes = isEnabled(bundle.features, 'learning.notes')
  const whatsapp = waHref(brand, 'Hi, I have a question about my course.')

  const tabs: Array<{ key: LearnerTab; label: string; href: string; icon: IconName }> = [
    { key: 'home', label: 'Home', href: '/dashboard', icon: 'home' },
    ...(slug ? [
      { key: 'lessons' as const, label: 'My course', href: `/learn/${slug}/material`, icon: 'book' as const },
      { key: 'live' as const, label: 'Live classes', href: `/learn/${slug}/live`, icon: 'live' as const },
      ...(notes ? [{ key: 'notes' as const, label: 'My notes', href: '/learn/notes', icon: 'note' as const }] : []),
    ] : []),
  ]
  const v = account.viewer
  const menu = v && (
    <AccountMenu name={v.name} email={v.email} initials={v.initials || initialsOf(v.name)} items={v.menu} logoutHref={v.logoutHref} whatsapp={whatsapp} />
  )

  if (focus) {
    return (
      <V11Frame
        shell="focus"
        header={
          <header className="fbar">
            <div className="fbar-in">
              <Link href={focus.backHref} className="fback"><Ic n="back" />{focus.backLabel}</Link>
              <p className="fwhere">{focus.where}</p>
              {focus.progress && (
                <p className="fprog">
                  <span className="bar" role="progressbar" aria-valuenow={Math.round(focus.progress.pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><i style={{ width: `${Math.max(0, Math.min(100, focus.progress.pct))}%` }} /></span>
                  {focus.progress.label}
                </p>
              )}
              {whatsapp && <a className="fhelp" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Stuck? Message us on WhatsApp"><Wa /><span>Need help?</span></a>}
              {menu}
            </div>
          </header>
        }
      >
        {children}
      </V11Frame>
    )
  }

  return (
    <V11Frame
      shell="app"
      header={
        <>
          <header className="ah">
            <div className="ah-in">
              <Brand brand={brand} href="/dashboard" />
              <nav className="ah-nav" aria-label="Learning">
                {tabs.map((t) => <Link key={t.key} href={t.href} aria-current={active === t.key ? 'page' : undefined}>{t.label}</Link>)}
              </nav>
              <div className="ah-end">
                {whatsapp && <a className="ah-help" href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Need help? Message us on WhatsApp"><Wa /><span>Need help?</span></a>}
                {menu}
              </div>
            </div>
          </header>
          {tabs.length > 1 && (
            <nav className="subnav" aria-label="Learning, short">
              <ul style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
                {tabs.map((t) => <li key={t.key}><Link href={t.href} aria-current={active === t.key ? 'page' : undefined}>{t.label}</Link></li>)}
              </ul>
            </nav>
          )}
        </>
      }
      footer={
        tabs.length > 1 ? (
          <nav className="tabbar" aria-label="Learning, tabs" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((t) => <Link key={t.key} href={t.href} aria-current={active === t.key ? 'page' : undefined}><Ic n={t.icon} />{t.label}</Link>)}
          </nav>
        ) : null
      }
    >
      {children}
    </V11Frame>
  )
}

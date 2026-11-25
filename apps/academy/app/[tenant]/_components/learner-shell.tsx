import Link from 'next/link'
import type { ReactNode } from 'react'
import { isEnabled } from '@educore/features'
import { Icon, type IconName } from '@educore/ui/marks'
import { getLeadCourseSlug } from '@/lib/learn'
import type { Access } from '@/lib/dal'
import type { getShell } from '@/lib/shell'
import { AccountMenu } from './account-menu'
import './lx.css'
import './learner-home.css'

/*
 * The learner's app frame. Every signed-in learning screen (Home, Lessons, Live classes, Notes) sits inside it, so the
 * four places a student goes are always in the same spot: a left sidebar on a laptop, a tab bar at the bottom of a phone.
 * The marketing header and footer do not appear here. Names are the plainest words: Home, Lessons, Live classes, Notes.
 */
export type LearnerTab = 'home' | 'lessons' | 'live' | 'notes'
/** A focus screen (a lesson, a quiz): no sidebar, a slim bar with the way back, where you are, and how far along. */
export interface Focus { backHref: string; backLabel: string; where?: string; progress?: { pct: number; label: string } }
type Shell = Awaited<ReturnType<typeof getShell>>

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

/** "CloudCadre" is split into two coloured halves (plan/15 §7.3); any other name stays whole. */
function Wordmark({ name }: { name: string }) {
  const m = /^([A-Z][a-z]+)([A-Z][a-z]+)$/.exec(name)
  return m ? <span>{m[1]}<span className="c2">{m[2]}</span></span> : <span>{name}</span>
}

function Brand({ brand }: { brand: Shell['brand'] }) {
  return (
    <Link href="/dashboard" className="lx-brand" aria-label={`${brand.name}: Home`}>
      {brand.logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={brand.logoUrl} alt={brand.name} />
        : <><svg viewBox="0 0 799 612" aria-hidden="true"><use href="#logo" /></svg><Wordmark name={brand.name} /></>}
    </Link>
  )
}

export async function LearnerShell({ a, shell, active, wide = false, focus, children }: { a: Access; shell: Shell; active: LearnerTab | null; wide?: boolean; focus?: Focus; children: ReactNode }) {
  const { theme, brand, account, bundle } = shell
  const slug = await getLeadCourseSlug(a)
  const notes = isEnabled(bundle.features, 'learning.notes')
  const digits = (brand.contact?.whatsapp ?? '').replace(/\D/g, '')
  const whatsapp = digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent('Hi, I have a question about my course.')}` : null

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
    <AccountMenu name={v.name} email={v.email} initials={v.initials || initialsOf(v.name)} items={v.menu} logoutHref={v.logoutHref} whatsapp={whatsapp} opens="up" />
  )
  const menuTop = v && (
    <AccountMenu name={v.name} email={v.email} initials={v.initials || initialsOf(v.name)} items={v.menu} logoutHref={v.logoutHref} whatsapp={whatsapp} opens="down" />
  )

  if (focus) {
    return (
      <theme.FocusLayout brand={brand}>
        <div className="lx lx-focus">
          <a href="#main" className="lx-skip">Skip to content</a>
          <header className="lx-ftop">
            <Link href={focus.backHref} className="lx-fback"><Icon name="back" /><span>{focus.backLabel}</span></Link>
            <div className="lx-fwhere">{focus.where && <p>{focus.where}</p>}</div>
            {focus.progress && (
              <p className="lx-fprog">
                <span className="lx-bar" role="progressbar" aria-valuenow={Math.round(focus.progress.pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><i style={{ width: `${Math.max(0, Math.min(100, focus.progress.pct))}%` }} /></span>
                <span>{focus.progress.label}</span>
              </p>
            )}
            <div className="lx-fright">
              {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="lx-fhelp" aria-label="Stuck? Message us on WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#lg-whatsapp" /></svg><span>Need help?</span></a>}
              {menuTop}
            </div>
          </header>
          <main id="main" className="lx-fmain">{children}</main>
        </div>
      </theme.FocusLayout>
    )
  }

  return (
    <theme.FocusLayout brand={brand}>
      <div className="lx">
        <a href="#main" className="lx-skip">Skip to content</a>

        <aside className="lx-side">
          <div className="lx-rail">
            <Brand brand={brand} />
            <nav aria-label="Learning">
              <ul className="lx-nav">
                {tabs.map((t) => (
                  <li key={t.key}>
                    <Link href={t.href} aria-current={active === t.key ? 'page' : undefined}><Icon name={t.icon} />{t.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="lx-rail-foot">
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="lx-help">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#lg-whatsapp" /></svg>
                  <span><b>Stuck on something?</b>Message us on WhatsApp</span>
                </a>
              )}
              {menu}
            </div>
          </div>
        </aside>

        <header className="lx-top">
          <Brand brand={brand} />
          {menuTop}
        </header>

        <main id="main" className="lx-main">
          <div className={`lx-page${wide ? ' wide' : ''}`}>{children}</div>
        </main>

        <nav aria-label="Learning" className="lx-tabs" style={{ '--n': tabs.length } as React.CSSProperties}>
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} aria-current={active === t.key ? 'page' : undefined}><span className="pill"><Icon name={t.icon} /></span>{t.label}</Link>
          ))}
        </nav>
      </div>
    </theme.FocusLayout>
  )
}

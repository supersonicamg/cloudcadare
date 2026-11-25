import type { CSSProperties } from 'react'
import type { AuthLayoutProps, FocusLayoutProps, SiteLayoutProps } from '@educore/ui/theme'
import { WhatsAppFab } from './client'
import { SiteHeader } from './header'
import { schibsted } from './font'
import { A, Brand, WhatsAppIcon, waLink } from './parts'
import './aurora.css'
import './home.css'

export function SiteLayout({ brand, nav, account, site, children }: SiteLayoutProps) {
  const wa = waLink(brand)
  const phone = brand.contact?.phone
  const columns = [...(site?.footerColumns ?? [])]

  return (
    <div className={`${schibsted.variable} au-shell flex min-h-screen flex-col`}>
      {site?.announcement && wa && (
        <div className="au">
          <div className="ann">
            <span>{site.announcement.text}</span>
            <a href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />{site.announcement.linkLabel}<span className="ar" aria-hidden="true">→</span></a>
          </div>
        </div>
      )}
      <SiteHeader brand={brand} nav={nav} account={account} whatsapp={wa} />

      <main className="flex-1">{children}</main>

      <footer className="au">
        <div className="foot"><div className="wrap">
          <div className="foot-in" style={{ '--cols': columns.length + 1 } as CSSProperties}>
            <div>
              <Brand brand={brand} />
              {brand.tagline && <p className="about">{brand.tagline}</p>}
            </div>
            {columns.map((c) => (
              <div key={c.title}>
                <h2>{c.title}</h2>
                <ul>{c.links.map((l) => <li key={l.href + l.label}><A href={l.href}>{l.label}</A></li>)}</ul>
              </div>
            ))}
            <div>
              <h2>Help</h2>
              <ul>
                {wa && <li><a href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />{phone ?? 'Chat on WhatsApp'}</a></li>}
                {!wa && phone && <li><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a></li>}
                {brand.contact?.email && <li><a href={`mailto:${brand.contact.email}`}>{brand.contact.email}</a></li>}
                <li><A href={account.href}>{account.label}</A></li>
              </ul>
            </div>
          </div>
          <div className="foot-base">
            <span>&copy; {brand.year} {brand.name}. All rights reserved.{site?.disclaimer ? ` ${site.disclaimer}` : ''}{brand.showPoweredBy ? ` Powered by ${brand.platformName}.` : ''}</span>
            {site?.legal && site.legal.length > 0 && (
              <span>{site.legal.map((l, i) => <span key={l.href}>{i > 0 && ' · '}<A href={l.href}>{l.label}</A></span>)}</span>
            )}
          </div>
        </div></div>
      </footer>

      {wa && <WhatsAppFab href={wa} />}
    </div>
  )
}

export function AuthLayout({ brand, site, children }: AuthLayoutProps) {
  const wa = waLink(brand)
  const art = site?.authArt
  return (
    <div className={`${schibsted.variable} au-shell au-split`}>
      <aside className="au-split-art">
        <div className="au" style={{ background: 'none' }}>
          <Brand brand={brand} />
          {art && (
            <div className="ha-media">
              <div className="ha-back shape" />
              <div className="ha-photo shape">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="photo" src={art.image.src} alt={art.image.alt} />
                {art.tag && <div className="ha-tag"><span>{art.tag}</span></div>}
              </div>
            </div>
          )}
        </div>
      </aside>
      <div className="au-split-main">
        <div className="au-split-card">{children}</div>
        {wa && (
          <p className="au-split-help">
            <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#lg-whatsapp" /></svg>
            Stuck? <a href={wa} target="_blank" rel="noopener noreferrer">Chat with us on WhatsApp</a>
          </p>
        )}
      </div>
    </div>
  )
}

export function FocusLayout({ brand, bar, children }: FocusLayoutProps) {
  return (
    <div className={`${schibsted.variable} au-shell min-h-screen`}>
      {bar && (
        <div className="au">
          <header className="focus-bar wrap">
            <Brand brand={brand} />
            <span className="focus-title">{bar.title}</span>
            {bar.note && (
              <span className="focus-note">
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
                {bar.note}
              </span>
            )}
            {bar.exit && <A href={bar.exit.href} className="focus-exit">{bar.exit.label}</A>}
          </header>
        </div>
      )}
      {children}
    </div>
  )
}

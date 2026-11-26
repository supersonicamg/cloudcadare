import Link from 'next/link'
import type { BrandInfo } from '@educore/ui/theme'
import { Ic, Wa } from './v11'

/** wa.me link from the academy's own WhatsApp number, or null when it has none (every WhatsApp control then disappears). */
export function waHref(brand: BrandInfo, message: string): string | null {
  const digits = (brand.contact?.whatsapp ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null
}

/** Logo mark and typed wordmark (guide §10.12). An uploaded logo replaces both. */
export function Brand({ brand, href = '/' }: { brand: BrandInfo; href?: string }) {
  return (
    <Link href={href} className="logo" aria-label={`${brand.name}${href === '/' ? ' home' : ': Home'}`}>
      {brand.logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={brand.logoUrl} alt={brand.name} style={{ width: 'auto', height: 32 }} />
        : <><svg viewBox="0 0 799 612" width="32" height="25" aria-hidden="true"><use href="#logo" /></svg>{brand.name}</>}
    </Link>
  )
}

/**
 * Checkout and payment-status bar: logo, "Secure checkout" in the middle, one way out. Focus layout, logo only (guide §15).
 */
export function CheckoutBar({ brand, middle, exit }: { brand: BrandInfo; middle: 'secure' | string; exit: { href: string; label: string } }) {
  return (
    <header className="fbar cbar">
      <div className="fbar-in">
        <Brand brand={brand} />
        <p className="mid">{middle === 'secure' ? <><Ic n="lock" s /><span>Secure checkout</span></> : <span>{middle}</span>}</p>
        <Link className="fback" href={exit.href}>{exit.label}</Link>
      </div>
    </header>
  )
}

/** The dark marketing header for public pages (verify): logo, Log in, outline "WhatsApp us". Same as the home page. */
export function SiteBar({ brand }: { brand: BrandInfo }) {
  const wa = waHref(brand, 'Hi, I have a question about your courses.')
  return (
    <header className="site-hd">
      <div className="ah-in">
        <Brand brand={brand} />
        <div className="ah-end">
          <Link className="login" href="/login">Log in</Link>
          {wa && <a className="ah-help" href={wa} target="_blank" rel="noopener noreferrer" aria-label="Message us on WhatsApp"><Wa /><span>WhatsApp us</span></a>}
        </div>
      </div>
    </header>
  )
}

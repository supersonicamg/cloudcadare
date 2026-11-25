import Link from 'next/link'
import type { ComponentProps } from 'react'
import type { BrandInfo } from '@educore/ui/theme'
import { Logo, Sprite } from '@educore/ui/marks'

/** Internal paths use the router; everything else is a plain link. */
export function A({ href, ...rest }: Omit<ComponentProps<'a'>, 'href'> & { href: string }) {
  return href.startsWith('/') ? <Link href={href} {...rest} /> : <a href={href} {...rest} />
}

export const Arrow = () => <span className="ar" aria-hidden="true">→</span>

export function WhatsAppIcon() {
  return <svg className="wa" viewBox="0 0 24 24" aria-hidden="true"><use href="#lg-whatsapp" /></svg>
}

/**
 * wa.me link from the academy's WhatsApp number, or null when it has none (every WhatsApp control then disappears).
 * The number is never invented: it comes only from the academy's contact settings.
 */
export function waLink(brand: BrandInfo, message = 'Hi, I have a question about your courses.'): string | null {
  const digits = (brand.contact?.whatsapp ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" role="img" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <svg key={i} className={i > n ? 'off' : undefined} aria-hidden="true"><use href="#star" /></svg>)}
    </span>
  )
}

/**
 * The wordmark is typed text, never an image (plan/15 §7.3): "Cloud" in ink, "Cadre" in the brand colour.
 * Only a name made of two capitalised words is split; any other name stays whole.
 */
function Wordmark({ name }: { name: string }) {
  const m = /^([A-Z][a-z]+)([A-Z][a-z]+)$/.exec(name)
  return m ? <span>{m[1]}<span className="c2">{m[2]}</span></span> : <span>{name}</span>
}

export function Brand({ brand, href }: { brand: BrandInfo; href?: string }) {
  return (
    <Link className="brand" href={href ?? '/'} aria-label={href ? `${brand.name}: your dashboard` : `${brand.name} home`}>
      {brand.logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="brand-img" src={brand.logoUrl} alt={brand.name} />
        : <><svg className="logo" viewBox="0 0 799 612" aria-hidden="true"><use href="#logo" /></svg><Wordmark name={brand.name} /></>}
    </Link>
  )
}

export { Logo, Sprite }

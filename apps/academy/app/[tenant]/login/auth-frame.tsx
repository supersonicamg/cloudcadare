import type { ReactNode } from 'react'
import type { BrandInfo } from '@educore/ui/theme'
import { V11Frame } from '../_components/v11'
import { Brand } from '../_components/v11-bars'
import './auth.css'

/** The photo on the left of sign in and sign up (aurora-content.ts). Without one, the form is the whole page. */
export interface AuthPhoto { src: string; alt: string }

/**
 * Sign in, sign up and email code (guide §15): a photo on one side (hidden on phones), the form on the other. `children` is the form side: start it with <AuthTop> and then the `.auth-box`.
 */
export function AuthFrame({ brand, photo, children }: { brand: BrandInfo; photo?: AuthPhoto | null; children: ReactNode }) {
  return (
    <V11Frame shell="none">
      <div className={photo ? 'auth' : 'auth no-ph'}>
        {photo && (
          <figure className="auth-ph">
            <Brand brand={brand} />
            {/* A plain <img>: the photo is a remote placeholder, like the home page hero. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
          </figure>
        )}
        <div className="auth-f">{children}</div>
      </div>
    </V11Frame>
  )
}

/** The logo (phones, and when there is no photo) and, on the right, the line that leads to the other form. */
export function AuthTop({ brand, children }: { brand: BrandInfo; children?: ReactNode }) {
  return (
    <div className="auth-top">
      <Brand brand={brand} />
      {children && <p className="t-small">{children}</p>}
    </div>
  )
}

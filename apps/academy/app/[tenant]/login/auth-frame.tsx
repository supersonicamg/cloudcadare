import type { ReactNode } from 'react'
import type { BrandInfo } from '@educore/ui/theme'
import { V11Frame } from '../_components/v11'
import { Brand } from '../_components/v11-bars'
import './auth.css'

/** The real learner on the photo side of sign in and sign up (aurora-content.ts). Without one, the form is the whole page. */
export interface AuthLearner { photo: string; alt: string; package: string; name: string; role: string; company: string }

/**
 * Sign in, sign up and email code (guide §15): a real learner with the ₹ LPA line on one side (hidden on phones), the
 * form on the other. `children` is the form side: start it with <AuthTop> and then the `.auth-box`.
 */
export function AuthFrame({ brand, learner, children }: { brand: BrandInfo; learner?: AuthLearner | null; children: ReactNode }) {
  return (
    <V11Frame shell="none">
      <div className={learner ? 'auth' : 'auth no-ph'}>
        {learner && (
          <figure className="auth-ph">
            <Brand brand={brand} />
            {/* The learner's own photo, on the old site's image host: a plain <img>, like the home page hero. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={learner.photo} alt={learner.alt} loading="lazy" decoding="async" />
            <figcaption>
              <span className="t-num tnum">₹{learner.package} LPA</span>
              <p><b>{learner.name}</b>, {brand.name} learner · {learner.role}, {learner.company}</p>
            </figcaption>
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

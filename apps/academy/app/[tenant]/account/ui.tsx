import type { ReactNode } from 'react'
import type { BrandInfo } from '@educore/ui/theme'
import { Ic } from '../_components/v11'

/**
 * Status as a shape and a word (guide §2: never colour alone). Done = tick, waiting = clock, needs you = info mark,
 * ended or cancelled = the word alone, quieter.
 */
export type Tone = 'ok' | 'wait' | 'action' | 'quiet'
export function St({ tone, children }: { tone: Tone; children: ReactNode }) {
  if (tone === 'quiet') return <span className="st quiet">{children}</span>
  return <span className="st"><Ic n={tone === 'ok' ? 'check' : tone === 'wait' ? 'clock' : 'info'} />{children}</span>
}

/** The academy's mark, drawn small: an uploaded logo replaces the drawn one. */
export function BrandMark({ brand, width = 22 }: { brand: BrandInfo; width?: number }) {
  return brand.logoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={brand.logoUrl} alt="" style={{ width: 'auto', height: Math.round(width * 0.77) }} />
    : <svg viewBox="0 0 799 612" width={width} height={Math.round(width * 612 / 799)} aria-hidden="true" focusable="false"><use href="#logo" /></svg>
}

/** A small certificate drawn in code: how the name will be printed (guide §17). `dim` greys it before it is earned. */
export function CertMini({ mark, name, program, dim }: { mark: ReactNode; name: ReactNode; program?: string | null; dim?: boolean }) {
  return (
    <div className={`certmini${dim ? ' cert-dim' : ''}`} aria-hidden="true">
      <div>
        {mark}
        <span className="t-label">Certificate of completion</span>
        <span className="t-h3 nm-pv">{name}</span>
        {program && <span className="t-label">{program}</span>}
      </div>
    </div>
  )
}

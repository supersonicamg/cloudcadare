import type { CSSProperties, ReactNode } from 'react'
import { hanken } from '@educore/theme-aurora/font'
import { V11_SPRITE } from './v11-sprite'
import './v11.css'

/*
 * The shared parts of the learner app on design guide v11 (plan/15). Every learner, account, sign-in and checkout screen
 * is built from these plus the classes in v11.css (which are the classes of plan/mockups/app-v11.html, scoped under .v11).
 * Nothing here is themed per academy: like the home page, the app uses the fixed v11 ink + saffron values.
 */

export type IconName =
  | 'home' | 'book' | 'live' | 'note' | 'play' | 'pause' | 'check' | 'x' | 'lock' | 'clock' | 'cal' | 'search' | 'video' | 'doc'
  | 'image' | 'quiz' | 'lab' | 'read' | 'chev' | 'down-c' | 'back' | 'bookmark' | 'hl' | 'pen' | 'user' | 'pass' | 'receipt'
  | 'shield' | 'key' | 'laptop' | 'phone' | 'down' | 'up' | 'info' | 'ext' | 'copy' | 'mail' | 'chart' | 'medal' | 'out'
  | 'gear' | 'full' | 'vol' | 'list' | 'wa'

/** A 24px line icon from the v11 sprite. `s` makes it 16px. */
export function Ic({ n, s, className }: { n: IconName; s?: boolean; className?: string }) {
  return <svg className={`ic${s ? ' ic-s' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true" focusable="false"><use href={`#i-${n}`} /></svg>
}

/** The WhatsApp glyph (18px, takes the text colour). */
export function Wa({ className }: { className?: string }) {
  return <svg className={`wa${className ? ` ${className}` : ''}`} aria-hidden="true" focusable="false"><use href="#i-wa" /></svg>
}

export type DiagramId = 'dg1' | 'dg2' | 'dg3' | 'dg4' | 'dg-tag'
/** Months of the program, in order: one app on three clouds, a smaller bill, code to Kubernetes, design it and defend it. */
export const MONTH_DIAGRAMS: DiagramId[] = ['dg1', 'dg2', 'dg3', 'dg4']
const DIAGRAM_LABELS: Record<DiagramId, string> = {
  dg1: 'One app running on AWS, Azure and Google Cloud',
  dg2: 'A monthly cloud bill, cut down after optimisation',
  dg3: 'A pipeline from code through Terraform and Docker to Kubernetes',
  dg4: 'Your architecture, reviewed by a panel, then two mock interviews',
  'dg-tag': 'Three resources: two tagged with a team, one with no owner',
}
/** The diagram of a month (1-based; wraps after four), drawn in code (plan/15 §11). */
export const diagramOfMonth = (n: number): DiagramId => MONTH_DIAGRAMS[(Math.max(1, n) - 1) % MONTH_DIAGRAMS.length]!

/** A code-drawn diagram at 8:5. Give `label` to name it for screen readers; leave it out when the card's own text already says it (alt="" rule). */
export function Dg({ id, label, className = 'dg' }: { id: DiagramId; label?: string | false; className?: string }) {
  const named = label !== false
  return (
    <svg className={className} viewBox="0 0 320 200" role={named ? 'img' : undefined} aria-label={named ? (label || DIAGRAM_LABELS[id]) : undefined} aria-hidden={named ? undefined : true}>
      <use href={`#${id}`} />
    </svg>
  )
}

/** The icon and diagram sprite. Rendered once per frame. */
export function V11Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: V11_SPRITE }} />
    </svg>
  )
}

/**
 * The page frame. `shell` tells v11.css which bars to show:
 *   app    dark header + link row (tablet) + tab bar (phone)        learner screens
 *   focus  a slim white bar (.fbar) with the way back                lesson, quiz, checkout
 *   site   the dark marketing header (.site-hd)                      public pages such as /verify
 *   none   no bar                                                    sign in, sign up, certificate
 * The children are placed in `.scr`, the container whose width drives every cqi size on the page.
 */
export type Shell = 'app' | 'focus' | 'site' | 'none'
export function V11Frame({ shell, header, footer, className, children }: { shell: Shell; header?: ReactNode; footer?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`v11 ${hanken.variable}${className ? ` ${className}` : ''}`} data-shell={shell}>
      <V11Sprite />
      <a href="#main" className="sr">Skip to content</a>
      {header}
      <div className="scr" id="main" tabIndex={-1} style={{ outline: 'none' } as CSSProperties}>{children}</div>
      {footer}
    </div>
  )
}

/** Initials for an avatar. */
export const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

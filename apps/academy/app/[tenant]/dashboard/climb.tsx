import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Icon } from '@educore/ui/marks'

export interface Step { key: string; number: string; title: string; detail: string; state: 'done' | 'now' | 'open' | 'locked'; href?: string }

/** The program's months as rising steps (plan/15 §7.8): done months ticked, the current one dark, later ones say when they open. */
export function Climb({ steps, label, goal }: { steps: Step[]; label: string; goal?: string }) {
  return (
    <ol className="ld-climb" aria-label={label} style={{ '--n': steps.length } as CSSProperties}>
      {steps.map((s, i) => {
        const cls = `ld-step ${s.state}`
        const name = `Month ${i + 1}: ${s.title}. ${s.detail}${goal && i === steps.length - 1 ? `. Goal: ${goal}` : ''}`
        const body = (
          <>
            {goal && i === steps.length - 1 && <span className="goal"><Icon name="flag" className="h-4 w-4" />{goal}</span>}
            <span className="mn" aria-hidden="true">{s.number}{s.state === 'done' && <Icon name="check" />}</span>
            <span className="t">{s.title}</span>
            <span className="s">{s.detail}</span>
          </>
        )
        return (
          <li key={s.key} className="contents">
            {s.href
              ? <Link href={s.href} className={cls} aria-label={name} aria-current={s.state === 'now' ? 'step' : undefined} style={{ '--i': i } as CSSProperties}>{body}</Link>
              : <div className={cls} style={{ '--i': i } as CSSProperties}><span className="sr-only">{name}</span><div className="contents" aria-hidden="true">{body}</div></div>}
          </li>
        )
      })}
    </ol>
  )
}

'use client'

import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@educore/ui/marks'

export interface Pane { key: string; label: string; icon: IconName; content: ReactNode }

/**
 * What to add to a month, one choice at a time. Every pane stays mounted (only hidden): the page refreshes after each
 * uploaded file, and switching panes must never throw away the uploads still running.
 * An empty month opens its first pane; a month with lessons starts closed.
 */
export function AddPanel({ id, empty, panes }: { id: string; empty: boolean; panes: Pane[] }) {
  const [open, setOpen] = useState<string | null>(empty ? (panes[0]?.key ?? null) : null)
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {panes.map((p) => (
          <button key={p.key} type="button" aria-expanded={open === p.key} aria-controls={`${id}-${p.key}`} onClick={() => setOpen((now) => (now === p.key ? null : p.key))}
            className={`inline-flex h-11 items-center gap-2 rounded-[10px] border-2 px-4 text-[15px] font-semibold ${open === p.key ? 'border-primary bg-[#E4EFEB] text-deep' : 'border-border text-fg hover:border-fg'}`}>
            <Icon name={p.icon} className="h-5 w-5 text-primary" /> {p.label}
          </button>
        ))}
      </div>
      {panes.map((p) => <div key={p.key} id={`${id}-${p.key}`} hidden={open !== p.key} className="rounded-2xl bg-muted p-4">{p.content}</div>)}
    </div>
  )
}

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Icon, type IconName } from '@educore/ui/marks'

// The admin's building blocks (plan/15 §14: functional screens on the site's colours, type and radius). Each page:
// a title that says what the page is for, then white cards, one job each, with at most one filled button in view.

export function PageHeader({ title, lead, back, children }: { title: string; lead?: ReactNode; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="mb-7">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex min-h-11 items-center gap-2 t-label !text-primary">
          <Icon name="back" className="h-5 w-5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="t-title">{title}</h1>
          {lead && <p className="mt-2 t-lead">{lead}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </header>
  )
}

export function Card({ title, lead, children, className = '', id }: { title?: ReactNode; lead?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,31,.06)] ring-1 ring-border sm:p-6 ${className}`}>
      {title && <h2 className="t-section">{title}</h2>}
      {lead && <p className="mt-1 t-body">{lead}</p>}
      <div className={title || lead ? 'mt-5' : ''}>{children}</div>
    </section>
  )
}

/** The pages of one section, as large text tabs. `badge` is a count that needs attention. */
export function Tabs({ label, current, items }: { label: string; current: string; items: { href: string; label: string; badge?: number }[] }) {
  if (items.length < 2) return null
  return (
    <nav aria-label={label} className="mb-7 flex gap-x-1 overflow-x-auto border-b-2 border-border">
      {items.map((t) => {
        const on = t.href === current
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
            className={`-mb-0.5 inline-flex min-h-12 shrink-0 items-center gap-2 border-b-[3px] px-3.5 t-label ${on ? 'border-primary !text-fg !font-bold' : 'border-transparent hover:!text-fg'}`}>
            {t.label}
            {t.badge ? <span className="rounded-full bg-accent px-2 text-[13px] font-bold tabular-nums text-fg">{t.badge}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}

export function Empty({ icon = 'info', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl bg-muted px-6 py-9 text-center ring-1 ring-border">
      <Icon name={icon} className="h-8 w-8 text-primary" />
      <p className="t-card">{title}</p>
      {children && <div className="t-body max-w-md">{children}</div>}
    </div>
  )
}

/** A big "what do you want to do?" link. */
export function Task({ href, icon, title, text, badge }: { href: string; icon: IconName; title: string; text: string; badge?: number }) {
  return (
    <Link href={href} className="group flex items-start gap-4 rounded-[20px] bg-white p-5 ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(20,32,31,.10)]">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#E4EFEB] text-primary"><Icon name={icon} className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 t-card group-hover:!text-primary">
          {title}
          {badge ? <span className="rounded-full bg-accent px-2.5 text-[14px] font-bold tabular-nums text-fg">{badge}</span> : null}
        </span>
        <span className="mt-1 block t-body">{text}</span>
      </span>
    </Link>
  )
}

export function Field({ id, label, hint, optional, children }: { id: string; label: string; hint?: ReactNode; optional?: boolean; children: ReactNode }) {
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="t-label !text-fg">{label}{optional && <span className="font-normal text-mute"> (optional)</span>}</label>
      {children}
      {hint && <p className="t-small">{hint}</p>}
    </div>
  )
}

/** A yes/no setting with its explanation. */
export function Check({ name, defaultChecked, title, hint }: { name: string; defaultChecked?: boolean; title: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 ring-1 ring-border has-checked:bg-[#F2F7F5] has-checked:ring-primary">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-primary)]" />
      <span><span className="block t-label !text-fg">{title}</span>{hint && <span className="mt-0.5 block t-small">{hint}</span>}</span>
    </label>
  )
}

export const dripDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const minutes = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : null)

export function ProgressBar({ pct, label, className = '' }: { pct: number; label: string; className?: string }) {
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className={`h-2.5 w-full overflow-hidden rounded-full bg-border ${className}`}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

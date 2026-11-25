// Dates and times the way learners read them (plan/15 §1): "12 Jan", "12 Jan 2027", "7 pm", "7:30 pm".
// Always Asia/Kolkata so a server in another time zone does not move a class to the wrong day.
const TZ = 'Asia/Kolkata'

/** "12 Jan" */
export function dateShort(iso: string | Date) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso))
}

/** "12 Jan 2027". Use where the year matters (access end, receipts). */
export function dateLong(iso: string | Date) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso))
}

/** "7 pm" or "7:30 pm" */
export function timeShort(iso: string | Date) {
  const parts = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const min = get('minute')
  return `${get('hour')}${min === '00' ? '' : `:${min}`} ${get('dayPeriod').toLowerCase()}`
}

/** Whole days from `from` until `to` (negative once passed). Pass `from` in; pages must not read the clock while prerendering. */
export const daysUntil = (to: string | Date, from: number) => Math.ceil((new Date(to).getTime() - from) / 86_400_000)

/** "36 of 86 lessons" style counts are plain numbers; this groups large ones the Indian way (1,20,000). */
export const count = (n: number) => new Intl.NumberFormat('en-IN').format(n)

/** The clock, for server pages that already read the session (so they are never prerendered). Kept out of components for the purity lint. */
export const nowMs = () => Date.now()

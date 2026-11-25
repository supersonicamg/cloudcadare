// Shared control styles. Colours come from the academy's tokens; sizes follow the aurora design
// (one filled action per view, 2px field borders, 56px primary buttons on learner pages).
export const input =
  'w-full rounded-xl border-2 border-field bg-white px-4 py-2.5 text-base outline-none focus:border-primary focus:ring-4 focus:ring-accent/55'
/** Large field for learner-facing forms (sign in, coupon). */
export const inputLg = `${input} h-14 text-[17px]`
export const button =
  'rounded-[10px] bg-primary px-5 py-2.5 text-[15px] font-semibold text-primary-fg hover:bg-deep disabled:opacity-60'
/** The one filled action on a learner page. */
export const buttonLg =
  'inline-flex h-14 items-center justify-center gap-2.5 rounded-xl bg-primary px-7 text-[17px] font-semibold text-primary-fg hover:bg-deep disabled:cursor-not-allowed disabled:bg-[#D9D6CC] disabled:text-[#6A726F]'
export const buttonQuiet =
  'rounded-[10px] border-2 border-fg px-3.5 py-1.5 text-[15px] font-semibold hover:bg-muted disabled:opacity-60'
export const buttonLine =
  'inline-flex h-14 items-center justify-center gap-2.5 rounded-xl border-2 border-fg px-7 text-[17px] font-semibold hover:bg-muted'
export const label = 'block t-label !text-fg'
export const hint = 't-small'

// Type roles come from the app type scale in packages/ui/src/styles.css (t-title, t-section, t-card, t-body, t-lead, t-label, t-small, t-num).
export const h1s = 't-title'
export const h2s = 't-section'
export const h3s = 't-card'
export const lead = 't-lead'
export const body = 't-body'
export const meta = 't-label'
export const small = 't-small'
export const backLink = 'inline-flex items-center gap-2 text-base font-semibold text-primary'
/** Status chip. Pick one tone. */
export const chip = {
  base: 'inline-block whitespace-nowrap rounded-lg px-[11px] py-1 text-sm font-semibold',
  ok: 'bg-ok-bg text-ok-ink', warn: 'bg-tint-2 text-fg', bad: 'bg-danger-bg text-danger-ink', quiet: 'bg-[#ECE8DD] text-grey', info: 'bg-tint-1 text-fg',
}
export const chipClass = (tone: keyof typeof chip) => `${chip.base} ${chip[tone as 'ok']}`
/** Inline notice box. */
export const banner = {
  base: 'flex items-center gap-3 rounded-2xl px-[18px] py-3.5 text-base font-medium leading-snug',
  ok: 'bg-ok-bg text-ok-ink', bad: 'bg-danger-bg text-danger-ink', info: 'bg-tint-2 text-fg',
}
export const bannerClass = (tone: 'ok' | 'bad' | 'info') => `${banner.base} ${banner[tone]}`
/** Heavy rule above a list, as in the mockups. */
export const ruleTop = 'border-t-2 border-fg'

// ---- Staff admin (same tokens, denser than the learner pages)
/** Title row: heading on the left, the page's one filled action on the right. Wraps on phones. */
export const pageHead = 'mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4'
export const pageTitle = 't-title'
export const pageLead = 'mt-2 max-w-2xl t-lead'
/** Row of big numbers between two heavy rules. */
export const statRow = 'grid border-y-2 border-fg'
/** Section heading inside an admin page. */
export const sectionTitle = 't-section'
/** Small filled action (the only one on its view). */
export const buttonSm =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-[18px] text-[15px] font-semibold text-primary-fg hover:bg-deep disabled:opacity-60'
/** Small outline action. */
export const buttonOutline =
  'inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border-2 border-fg px-[18px] text-[15px] font-semibold hover:bg-muted disabled:opacity-60'
/** Compact field for staff forms and filters. */
export const inputSm =
  'h-11 w-full rounded-[10px] border-2 border-field bg-white px-3.5 text-[15px] outline-none focus:border-primary focus:ring-4 focus:ring-accent/55'
/** Table head and cell styles; wrap the table in `tableWrap` so wide tables scroll instead of breaking the page. */
export const tableWrap = 'overflow-x-auto'
export const th = 'border-b border-border px-3 py-2.5 text-left text-[13px] font-bold tracking-normal text-mute first:pl-0 last:pr-0'
export const td = 'border-b border-border px-3 py-3.5 align-middle first:pl-0 last:pr-0'
export const statusTone = { draft: 'info', review: 'info', published: 'ok', archived: 'quiet' } as const

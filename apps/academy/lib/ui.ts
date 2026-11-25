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
export const label = 'block text-[15px] font-semibold'
export const hint = 'text-sm text-mute'

export const h1s = 'font-heading text-[clamp(32px,3.4vw,44px)] font-extrabold leading-[1.04] tracking-[-0.04em] text-balance'
export const h2s = 'font-heading text-[clamp(26px,2.6vw,34px)] font-bold leading-[1.1] tracking-[-0.035em] text-balance'
export const lead = 'text-lg leading-relaxed text-grey'
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

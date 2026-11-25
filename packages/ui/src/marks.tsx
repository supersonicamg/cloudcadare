import type { SVGProps } from 'react'
import type { LogoKey } from './theme'
import { SPRITE } from './sprite'

/**
 * Platform logos, the slanted photo frame and the star, as one sprite. Render <Sprite /> once per page
 * (the tenant root layout does). <Logo> and the frame then point at it with <use>.
 */
export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: SPRITE }} />
    </svg>
  )
}

export function Logo({ name, label, className }: { name: LogoKey; label?: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <use href={`#lg-${name}`} />
    </svg>
  )
}

const PLATFORMS: Array<[RegExp, LogoKey]> = [
  [/\b(aws|amazon)\b/i, 'aws'], [/azure|\baz-?\d{3}\b/i, 'azure'], [/kubernetes|\bk8s\b|\bcka\b/i, 'kubernetes'],
  [/google cloud|\bgcp\b/i, 'gcp'], [/docker/i, 'docker'], [/terraform/i, 'terraform'], [/github/i, 'github'], [/python/i, 'python'], [/finops|greenops/i, 'finops'],
]
/** Best guess at which platform a course is about, from its title and tags. Null when it is none of them. */
export function platformFor(...texts: Array<string | null | undefined | string[]>): LogoKey | null {
  const hay = texts.flat().filter(Boolean).join(' ')
  return PLATFORMS.find(([re]) => re.test(hay))?.[1] ?? null
}

/** Names for the platform marks, for screen readers and tooltips. */
export const LOGO_NAMES: Record<LogoKey, string> = {
  aws: 'AWS', azure: 'Azure', gcp: 'Google Cloud', kubernetes: 'Kubernetes', docker: 'Docker',
  terraform: 'Terraform', github: 'GitHub', python: 'Python', finops: 'FinOps',
}

const PATHS = {
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  flag: <path d="M5 21V4M5 5h11l-2 4 2 4H5" />,
  bookmark: <path d="M7 3h10v18l-5-4-5 4z" />,
  note: <><path d="M4 4h16v12H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
  highlight: <><path d="M4 20h8" /><path d="M14 4l6 6-8 8-6-6z" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M4 18l5-5 4 4 3-3 4 4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  live: <><circle cx="12" cy="12" r="2.5" /><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9M4.5 4.5a10.6 10.6 0 000 15M19.5 4.5a10.6 10.6 0 010 15" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  down: <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14" />,
  video: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5l5 2.5-5 2.5z" /></>,
  lab: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 10l3 2-3 2M12 15h5" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  quiz: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14 10h3M14 16h3" /></>,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2.5" /></>,
  play: <path d="M8.5 6v12l9.5-6z" />,
  medal: <><circle cx="12" cy="9" r="5.5" /><path d="M8.7 13.6L7 21l5-2.6 5 2.6-1.7-7.4" /></>,
  flame: <path d="M12 3c.6 3.2 5 5.4 5 10.2A5 5 0 0 1 7 13.2c0-1.8.8-3 1.8-4 .2 1.6 1 2.4 1.9 2.8C10.4 9 10.8 5.6 12 3z" />,
  print: <><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="7" y="14" width="10" height="7" rx="1.5" /></>,
  shield: <path d="M12 3l7 3v5.5c0 4.4-2.9 8-7 9.5-4.1-1.5-7-5.1-7-9.5V6z M9 12l2.2 2.2L15.5 10" />,
  book: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5z" /><path d="M5 19.5V4.5" /></>,
} as const
export type IconName = keyof typeof PATHS

/** Inline line icon (no sprite needed). Colour follows the text colour. */
export function Icon({ name, className, ...rest }: { name: IconName; className?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className ?? 'h-5 w-5'} fill="none" stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {PATHS[name]}
    </svg>
  )
}

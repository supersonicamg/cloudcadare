import type { ReactNode } from 'react'
import type { DiagramKey, LogoKey } from '@educore/ui/theme'

// "What you build" drawings (plan/15 §11). Made in code, never generated images: a generated image cannot show an exact
// claim, never matches the others in style and garbles labels. viewBox 320 x 200, shown at 8:5 on a tile.
// Lines are ink at 1.5, tiles are white with a hairline, the site font for labels, and at most ONE saffron element per
// drawing: the thing that matters (the "After" bar, the design you defend). Tool logos come from the shared sprite (packages/ui/src/sprite.ts).
// No invented numbers inside a drawing (no "-32%").
const INK = '#0F1716'
const MUTED = '#5F6764'
const RULE = '#DCDAD3'
const SAFFRON = '#F2B33D'

const Logo = ({ k, x, y, size }: { k: LogoKey; x: number; y: number; size: number }) => <use href={`#lg-${k}`} x={x} y={y} width={size} height={size} />
const Tile = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => <rect x={x} y={y} width={w} height={h} rx={3} fill="#fff" stroke={RULE} />
const Arrow = ({ id }: { id: string }) => (
  <marker id={id} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={INK} /></marker>
)

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return <svg className="dg" viewBox="0 0 320 200" role="img" aria-label={label}>{children}</svg>
}

/** Month 1: one app wired to three clouds. */
function Clouds() {
  return (
    <Frame label="One app running on AWS, Azure and Google Cloud">
      <rect x={105} y={26} width={110} height={38} rx={3} fill={INK} />
      <text x={160} y={50} textAnchor="middle" fill="#fff" fontSize={14} fontWeight={600}>Your app</text>
      <path d="M160 64V94M60 94H260M60 94V122M160 94V122M260 94V122" stroke={INK} strokeWidth={1.5} fill="none" />
      {([['aws', 28], ['azure', 128], ['gcp', 228]] as const).map(([k, x]) => (
        <g key={k}><Tile x={x} y={122} w={64} h={54} /><Logo k={k} x={x + 14} y={132} size={36} /></g>
      ))}
    </Frame>
  )
}

/** Month 2: the same bill before and after. The saffron bar is the saving. */
function Bill() {
  return (
    <Frame label="A monthly cloud bill, cut down after optimisation">
      <defs><Arrow id="ah-bill" /></defs>
      <text x={40} y={30} fill={MUTED} fontSize={13}>Monthly cloud bill</text>
      <rect x={84} y={46} width={64} height={122} fill="#C9C6BD" />
      <rect x={176} y={92} width={64} height={76} fill={SAFFRON} />
      <path d="M152 46L172 88" stroke={INK} strokeWidth={1.5} strokeDasharray="4 4" fill="none" markerEnd="url(#ah-bill)" />
      <path d="M40 168H280" stroke={INK} strokeWidth={1.5} />
      <text x={116} y={188} textAnchor="middle" fill={INK} fontSize={13}>Before</text>
      <text x={208} y={188} textAnchor="middle" fill={INK} fontSize={13} fontWeight={600}>After</text>
    </Frame>
  )
}

/** Month 3: code, Terraform, Docker, Kubernetes. */
function Pipeline() {
  const steps = [['github', 'Code', 14], ['terraform', 'Terraform', 94], ['docker', 'Docker', 174], ['kubernetes', 'Kubernetes', 254]] as const
  return (
    <Frame label="A pipeline from code through Terraform and Docker to Kubernetes">
      <defs><Arrow id="ah-pipe" /></defs>
      {steps.map(([k, label, x]) => (
        <g key={k}>
          <Tile x={x} y={66} w={56} h={56} />
          <Logo k={k} x={x + 12} y={78} size={32} />
          <text x={x + 28} y={150} textAnchor="middle" fill={INK} fontSize={12}>{label}</text>
        </g>
      ))}
      <g stroke={INK} strokeWidth={1.5} fill="none" markerEnd="url(#ah-pipe)"><path d="M71 94H92" /><path d="M151 94H172" /><path d="M231 94H252" /></g>
    </Frame>
  )
}

/** Month 4: your architecture, a panel review, two mock interviews. The saffron bar is the design you defend. */
function Review() {
  return (
    <Frame label="Your architecture, reviewed by a panel, then two mock interviews">
      <defs><Arrow id="ah-rev" /></defs>
      <rect x={16} y={44} width={136} height={112} rx={3} fill="#fff" stroke={RULE} />
      <text x={30} y={66} fill={MUTED} fontSize={12}>Your architecture</text>
      <rect x={30} y={80} width={48} height={28} rx={2} fill="none" stroke={INK} strokeWidth={1.5} />
      <rect x={92} y={80} width={48} height={28} rx={2} fill="none" stroke={INK} strokeWidth={1.5} />
      <rect x={30} y={116} width={110} height={26} rx={2} fill={SAFFRON} />
      <path d="M78 94H92" stroke={INK} strokeWidth={1.5} />
      <path d="M160 100H180" stroke={INK} strokeWidth={1.5} fill="none" markerEnd="url(#ah-rev)" />
      <circle cx={204} cy={78} r={15} fill={INK} /><circle cx={204} cy={122} r={15} fill={INK} />
      <path d="M197 78l5 5 9-10M197 122l5 5 9-10" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g fill={INK} fontSize={13}><text x={228} y={74}>Panel</text><text x={228} y={89}>review</text><text x={228} y={118}>2 mock</text><text x={228} y={133}>interviews</text></g>
    </Frame>
  )
}

const DIAGRAMS: Record<DiagramKey, () => ReactNode> = { clouds: Clouds, bill: Bill, pipeline: Pipeline, review: Review }

export function Diagram({ k }: { k: DiagramKey }) {
  const D = DIAGRAMS[k]
  return <D />
}

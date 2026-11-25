import type { ReactNode } from 'react'
import type { DiagramKey, LogoKey } from '@educore/ui/theme'

// "You build" drawings (plan/15 §9). Made in code, never generated images: a generated image cannot show an exact
// claim, never matches the others in style and garbles labels. Teal lines (currentColor), white fills, round
// joins, exactly one yellow element per drawing, real tool logos, labels in the site font.
const Y = '#FFC845'

const hexPath = (cx: number, cy: number, r: number) =>
  [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6
    return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ') + 'Z'

// Shapes sit in one styled group (teal lines, white fill); logos and labels sit outside it and keep their own colours.
const Shapes = ({ children }: { children: ReactNode }) => (
  <g fill="#fff" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{children}</g>
)
const Hex = ({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) => <path d={hexPath(cx, cy, r)} fill={fill} />
const Logo = ({ k, x, y, size }: { k: LogoKey; x: number; y: number; size: number }) => <use href={`#lg-${k}`} x={x} y={y} width={size} height={size} />

/** The whole picture of the program: three clouds feeding one architecture, a pipeline, and falling costs. */
export function CeapArtShapes() {
  return (
    <>
      <path fill={Y} transform="translate(70 70)" d="M64.0 640.0Q0.0 640.0 20.1 579.2L191.3 60.8Q211.4 0.0 275.4 0.0L1147.4 0.0Q1211.4 0.0 1191.3 60.8L1020.1 579.2Q1000.0 640.0 936.0 640.0Z" />
      <path fill="#0A3F3B" d="M64.0 640.0Q0.0 640.0 20.1 579.2L191.3 60.8Q211.4 0.0 275.4 0.0L1147.4 0.0Q1211.4 0.0 1191.3 60.8L1020.1 579.2Q1000.0 640.0 936.0 640.0Z" />
      <g transform="translate(30 0)" fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M260 178H345A33 33 0 0 0 347 112A45 45 0 0 0 261 122A28 28 0 0 0 260 178Z" /><path d="M380 147H430" />
        <path d="M215 338H300A33 33 0 0 0 302 272A45 45 0 0 0 216 282A28 28 0 0 0 215 338Z" /><path d="M335 307H430" />
        <path d="M170 498H255A33 33 0 0 0 257 432A45 45 0 0 0 171 442A28 28 0 0 0 170 498Z" /><path d="M290 467H430" />
        <path d="M430 147V467M430 310H500" />
        <rect x="500" y="265" width="120" height="90" rx="20" />
        <path d="M620 310H666" /><circle cx="690" cy="310" r="24" />
        <path d="M714 310H741" /><circle cx="765" cy="310" r="24" />
        <path d="M789 310H816" /><circle cx="840" cy="310" r="24" />
        <path d="M864 310H891" /><circle cx="915" cy="310" r="24" />
        <rect x="630" y="380" width="52" height="150" rx="4" />
        <rect x="710" y="415" width="52" height="115" rx="4" />
        <rect x="790" y="448" width="52" height="82" rx="4" />
        <rect x="870" y="478" width="52" height="52" rx="4" fill={Y} />
        <path d="M600 530H950" />
        <rect x="466" y="112" width="512" height="462" rx="40" strokeDasharray="20 18" />
      </g>
    </>
  )
}

/** The CEAP drawing on its own: the hero picture when the academy has no photo yet. */
export function CeapArt() {
  return (
    <svg viewBox="0 0 1281 710" role="img" aria-label="Three clouds feeding one architecture, a delivery pipeline and falling costs">
      <CeapArtShapes />
    </svg>
  )
}

const Clouds = () => (
  <>
    <Shapes>
      <circle cx="180" cy="15" r="11" />
      <path fill="none" d="M169 15h22M180 4c-5 6-5 16 0 22M180 4c5 6 5 16 0 22" />
      <path fill="none" className="flow" d="M180 26v7M60 33h240M60 33v8M180 33v8M300 33v8" />
      {([['aws', 60], ['azure', 180], ['gcp', 300]] as const).map(([, cx]) => (
        <g key={cx}>
          <rect x={cx - 52} y="41" width="104" height="172" rx="12" fill="none" strokeDasharray="5 5" />
          <rect x={cx - 36} y="86" width="72" height="26" rx="6" />
          <path fill="none" className="flow" d={`M${cx} 112v10M${cx} 148v10`} />
          <rect x={cx - 36} y="122" width="72" height="26" rx="6" fill={Y} />
          <path d={`M${cx - 24} 166v24a24 7 0 0 0 48 0v-24`} />
          <ellipse cx={cx} cy="166" rx="24" ry="7" />
        </g>
      ))}
    </Shapes>
    {([['aws', 60], ['azure', 180], ['gcp', 300]] as const).map(([k, cx]) => (
      <g key={k}>
        <Logo k={k} x={cx - 14} y={48} size={28} />
        <text x={cx} y="103">Web</text><text x={cx} y="139">App</text><text x={cx} y="191">Data</text>
      </g>
    ))}
  </>
)

const Bill = () => (
  <>
    <Shapes>
      <rect x="20" y="22" width="132" height="180" rx="10" />
      <rect x="30" y="108" width="112" height="22" rx="5" fill={Y} stroke="none" />
      <path fill="none" d="M36 44h64" strokeWidth={3} />
      {[70, 94, 119, 144].map((y) => <path key={y} fill="none" d={`M36 ${y}h52M114 ${y}h24`} />)}
      <path fill="none" d="M36 164h100" strokeDasharray="3 4" />
      <path fill="none" d="M36 182h36M106 182h32" strokeWidth={3} />
      <path fill="none" className="flow" d="M162 112h28" /><path fill="none" d="M184 104l8 8-8 8" />
      <path fill="none" d="M206 192h138" />
      <rect x="220" y="52" width="46" height="140" rx="5" />
      <rect x="286" y="98" width="46" height="94" rx="5" fill={Y} />
      <rect x="278" y="62" width="62" height="24" rx="12" fill="currentColor" />
    </Shapes>
    <text x="243" y="210">Before</text><text x="309" y="210">After</text><text x="309" y="78" className="w">−32%</text>
  </>
)

const Pipeline = () => {
  const stages: Array<[LogoKey, number, string]> = [['github', 40, 'Code'], ['terraform', 120, 'Infra'], ['docker', 200, 'Build'], ['kubernetes', 280, 'Deploy']]
  return (
    <>
      <Shapes>
        {stages.map(([k, x], i) => (
          <g key={k}>
            <rect x={x - 26} y="34" width="52" height="52" rx="12" />
            {i < 3 && <path fill="none" className="flow" d={`M${x + 26} 60h28`} />}
          </g>
        ))}
        <path fill="none" className="flow" d="M306 60h14" />
        <circle cx="336" cy="60" r="16" fill={Y} /><path fill="none" d="M329 60l5 5 9-10" />
        <path fill="none" className="flow" d="M336 76v52" />
        <rect x="20" y="128" width="320" height="82" rx="14" fill="none" strokeDasharray="5 5" />
        <rect x="44" y="154" width="44" height="30" rx="6" /><path fill="none" d="M88 169h44M240 169h32" />
        <Hex cx={150} cy={169} r={17} fill="#fff" /><Hex cx={186} cy={169} r={17} fill={Y} /><Hex cx={222} cy={169} r={17} fill="#fff" />
        <path d="M272 160v18a18 6 0 0 0 36 0v-18" /><ellipse cx="290" cy="160" rx="18" ry="6" />
      </Shapes>
      {stages.map(([k, x, t]) => <g key={k}><Logo k={k} x={x - 15} y={45} size={30} /><text x={x} y="105">{t}</text></g>)}
      <text x="336" y="32" className="h">Live</text><text x="32" y="146" className="st sl">All built from code</text>
    </>
  )
}

const Review = () => {
  const rows: Array<[string, number]> = [['Cost', 74], ['Security', 106], ['Scale', 138]]
  return (
    <>
      <Shapes>
        <rect x="236" y="22" width="112" height="180" rx="12" />
        <path fill="none" className="flow" d="M216 110h14" />
        {rows.map(([t, y]) => (
          <g key={t}>
            <circle cx="256" cy={y} r="9" fill="currentColor" stroke="none" />
            <path d={`M251.5 ${y}l3 3 6-6.5`} fill="none" stroke="#fff" />
          </g>
        ))}
        <rect x="252" y="160" width="80" height="26" rx="13" fill={Y} stroke="none" />
      </Shapes>
      <svg x="0" y="40" width="214" height="119" viewBox="0 0 1281 710"><CeapArtShapes /></svg>
      <text x="292" y="46" className="h">Review</text>
      {rows.map(([t, y]) => <text key={t} x="272" y={y + 4} className="st">{t}</text>)}
      <text x="292" y="178" className="h">Passed</text><text x="4" y="186" className="st sl">Multi-cloud, automated, cost-aware</text>
    </>
  )
}

const DIAGRAMS: Record<DiagramKey, () => ReactNode> = { clouds: Clouds, bill: Bill, pipeline: Pipeline, review: Review }

/** Decorative: the caption above it says what is being built, so the drawing is hidden from screen readers. */
export function Diagram({ k }: { k: DiagramKey }) {
  const Art = DIAGRAMS[k]
  return <svg className="bart" viewBox="0 0 360 220" aria-hidden="true"><Art /></svg>
}

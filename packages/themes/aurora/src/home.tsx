import { defaultTheme } from '@educore/theme-default'
import type { BrandInfo, HomeContent, HomePageProps } from '@educore/ui/theme'
import { PhoneBar, Rail } from './client'
import { Diagram } from './diagrams'
import { A, WhatsAppIcon, waLink } from './parts'

type Content = HomeContent

// CloudCadre home, design guide version 11 (plan/15; reference build plan/mockups/home-v11.html).
//
// Brief. One job: say what this is, who it is for, when it starts and what it costs, then let the visitor join or talk to a
// person. One filled button per view (saffron "Join"); WhatsApp is an outline button or a text link. The visitor's
// questions, in order: what is it -> does it work -> what will I learn -> how is it taught -> when and how much -> my doubts.
// Every unit is a picture, one big value and one short line (plan/15 §3). No paragraphs, no arrows in buttons.
//
// Surfaces (plan/15 §4), touching sections never share one:
//   header + hero dark -> placements paper -> program white -> how classes work dark -> batch paper -> FAQ white -> footer dark.
// Images are plain <img>: the photos are remote placeholders until the academy has its own (plan/15 §12).

/** 1. Hero: the H1, one line, three facts (when, what time, how much), the one filled button, and a photo that fades into the dark. */
function Hero({ c, wa }: { c: Content['hero']; wa: string | null }) {
  return (
    <section className="hero dark" id="hero" aria-labelledby="h1">
      <div className="hero-copy">
        <h1 className="t-display" id="h1">{c.headline}</h1>
        <p className="t-lead">{c.lead}</p>
        <ul className="hfacts">
          {c.facts.map((f) => (
            <li key={f.label} className={f.note ? 'money' : undefined}>
              <span className="t-label">{f.label}</span>
              <b className="t-h3">{f.value}</b>
              {f.note && <small className="t-label">{f.note}</small>}
            </li>
          ))}
        </ul>
        <div className="hero-act" id="hero-act">
          <A className="btn" href={c.primaryCta.href}>{c.primaryCta.label}</A>
          {wa && <a className="link" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Ask on WhatsApp</a>}
        </div>
      </div>
      <figure className="hero-ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.photo.src} alt={c.photo.alt} style={c.photo.position ? { objectPosition: c.photo.position } : undefined} fetchPriority="high" />
      </figure>
    </section>
  )
}

/** 2. Placements: the model unit. Real faces, real packages, real employers; counted, never averaged. */
function Placements({ c }: { c: NonNullable<Content['placements']> }) {
  const cards = c.items.map((p) => ({
    key: p.name,
    node: (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="f" src={p.photo} alt="" width={240} height={240} loading="lazy" decoding="async" />
        <div className="pc-b">
          <p className="t-h3">₹{p.lpa}<small>LPA</small></p>
          <h3 className="pc-n">{p.name}</h3>
          <p className="t-small">{p.now}</p>
          <span className="co">
            {p.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.logo} alt={p.company} height={17} loading="lazy" decoding="async" />
              : p.company}
          </span>
        </div>
      </>
    ),
  }))
  return (
    <section className="sec place" id="placements" aria-labelledby="pl-h">
      <div className="wrap">
        <div className="sh">
          <div>
            <h2 className="t-h2" id="pl-h">{c.title}</h2>
            <p className="sum">
              {c.stats.map((s, i) => (
                <span key={s.value}>{i > 0 && ' · '}{s.prefix && `${s.prefix} `}<b>{s.value}</b>{s.label && ` ${s.label}`}</span>
              ))}
            </p>
          </div>
          <ul className="logos" aria-label="Employers">
            {c.logos.map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <li key={l.src} className={l.size}><img src={l.src} alt={l.alt} loading="lazy" /></li>
            ))}
          </ul>
        </div>
        <Rail className="wall" itemClassName="pc" items={cards} auto />
        <p className="t-small fine">{c.footnote}</p>
      </div>
    </section>
  )
}

/** 3. Program: four month cards, each led by a code-drawn diagram of what you build. */
function Program({ c, syllabus }: { c: NonNullable<Content['program']>; syllabus?: string }) {
  return (
    <section className="sec prog" id="program" aria-labelledby="prog-h">
      <div className="wrap">
        <div className="sh">
          <h2 className="t-h2" id="prog-h">{c.title}</h2>
          {syllabus && <a className="link" href={syllabus}>Full syllabus (PDF)</a>}
        </div>
        <Rail className="months" itemClassName="mc" ordered items={c.months.map((m) => ({
          key: String(m.n),
          node: (
            <>
              <Diagram k={m.diagram} />
              <div className="mc-b">
                <p className="t-label"><b>Month {m.n}</b> · {m.meta}</p>
                <h3 className="t-h3">{m.title}</h3>
                <p className="t-small">{m.line}</p>
              </div>
            </>
          ),
        }))} />
      </div>
    </section>
  )
}

/** 4. How classes work: a photo, one big number, three or four words. */
function How({ c }: { c: NonNullable<Content['how']> }) {
  return (
    <section className="sec how dark" id="how" aria-labelledby="how-h">
      <div className="wrap">
        <div className="sh"><h2 className="t-h2" id="how-h">{c.title}</h2></div>
        <Rail className="nums" auto items={c.tiles.map((t) => ({
          key: t.line,
          node: (
            <>
              <div className="ph">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image.src} alt={t.image.alt} loading="lazy" />
              </div>
              <b className="t-num">{t.value}</b>
              <p>{t.line}</p>
            </>
          ),
        }))} />
      </div>
    </section>
  )
}

/**
 * The week as two lines ("Live class · Sat–Sun, 11 am to 2 pm"). Phones show these instead of times squeezed into seven
 * cells. Days of one kind share one time.
 */
function slots(week: NonNullable<Content['batch']>['week']) {
  return ([['class', 'Live class'], ['lab', 'Practice']] as const).flatMap(([kind, name]) => {
    const days = week.filter((d) => d.kind === kind)
    const first = days[0]
    if (!first) return []
    const run = days.every((d, i) => week.indexOf(d) === week.indexOf(first) + i)
    const when = run && days.length > 1 ? `${first.day}–${days[days.length - 1]!.day}` : days.map((d) => d.day).join(', ')
    return [{ kind, name, when: first.time ? `${when}, ${first.time.join(' to ')}` : when }]
  })
}

/** 5. Next batch: one ticket with three pictures. The date as a calendar, the week as a timetable, the fee as one number. */
function Batch({ c, wa }: { c: NonNullable<Content['batch']>; wa: string | null }) {
  return (
    <section className="sec batch" id="batch" aria-labelledby="bt-h">
      <div className="wrap">
        <div className="sh"><h2 className="t-h2" id="bt-h">{c.title}</h2></div>
        <div className="ticket">
          <div className="cal">
            <span className="mo">{c.month}</span>
            <span className="d">{c.day}</span>
            <span className="t-label">{c.length}</span>
          </div>
          <div>
            <p className="t-label tk-h">Your week</p>
            <ul className="week" aria-label="Weekly schedule">
              {c.week.map((d) => (
                <li key={d.day} className={d.kind === 'class' ? 'on' : d.kind === 'lab' ? 'lab' : undefined}>
                  <span className="dn">{d.day}</span>
                  <span className="cell" aria-label={d.kind === 'free' ? 'free' : undefined}>
                    {d.time ? <>{d.time[0]}<br />{d.time[1]}</> : '–'}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="slots">
              {slots(c.week).map((s) => <div key={s.kind}><dt><i className={`k-${s.kind}`} />{s.name}</dt><dd>{s.when}</dd></div>)}
            </dl>
            <p className="legend"><span><i className="k-class" />Live class</span><span><i className="k-lab" />Practice</span><span>Every class is recorded</span></p>
          </div>
          <div className="fee">
            <p className="t-label tk-h">{c.fee.title}</p>
            <span className="t-num">{c.fee.amount}<small>{c.fee.per}</small></span>
            <p className="t-small">{c.fee.alt}</p>
            <A className="btn" href={c.join.href}>{c.join.label}</A>
            {wa && <a className="link" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Ask on WhatsApp</a>}
          </div>
        </div>
      </div>
    </section>
  )
}

/** 6. Questions before you join: a real person first, then five closed questions. */
function Talk({ c, brand }: { c: NonNullable<Content['talk']>; brand: BrandInfo }) {
  const p = c.counsellor
  const wa = p ? waLink(brand, p.message) : null
  return (
    <section className="sec" id="faq" aria-labelledby="faq-h">
      <div className="wrap">
        <div className={`faq-grid${p && wa ? '' : ' solo'}`}>
          {p && wa && (
            <aside className="person" aria-label="Talk to an admissions counsellor">
              <div className="ph">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo} alt="" loading="lazy" />
              </div>
              <p><b>{p.name}</b><br /><span className="t-small">{p.role}</span></p>
              <a className="btn btn-line" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Message {p.name.split(' ')[0]}</a>
            </aside>
          )}
          <div>
            <div className="sh"><h2 className="t-h2" id="faq-h">{c.faqTitle}</h2></div>
            <div className="faq">
              {c.faq.map((q) => <details key={q.question}><summary>{q.question}</summary><p>{q.answer}</p></details>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HomePage({ brand, content }: HomePageProps) {
  // No content supplied: show the plain fallback page instead of an empty design.
  if (!content) return <defaultTheme.HomePage brand={brand} />
  const wa = waLink(brand)
  return (
    <div className="cc cc-home">
      <Hero c={content.hero} wa={wa} />
      {content.placements && <Placements c={content.placements} />}
      {content.program && <Program c={content.program} syllabus={content.syllabusHref} />}
      {content.how && <How c={content.how} />}
      {content.batch && <Batch c={content.batch} wa={wa} />}
      {content.talk && <Talk c={content.talk} brand={brand} />}
      {content.batch && <PhoneBar {...content.batch.bar} href="/#batch" whatsapp={wa} />}
    </div>
  )
}

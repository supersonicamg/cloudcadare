import type { CSSProperties } from 'react'
import { defaultTheme } from '@educore/theme-default'
import { Icon, Logo, LOGO_NAMES } from '@educore/ui/marks'
import type { BrandInfo, HomeContent, HomePageProps, NavItem } from '@educore/ui/theme'
import { Climb } from './climb'
import { Reveal, StoryMarquee } from './client'
import { CeapArt } from './diagrams'
import { A, Arrow, Stars, WhatsAppIcon, waLink } from './parts'

type Content = HomeContent
type Join = NavItem

// Section structure follows plan/15 §3: page → mist panel → page → dark panel → page → stone panel.
// Every image here is `<img>`: the photos are remote placeholders until the academy has its own (plan/15 §10).

function Hero({ c, join, wa }: { c: Content['hero']; join: Join; wa: string | null }) {
  const { headline, trust } = c
  return (
    <section id="hero" aria-label="Introduction">
      <div className="wrap">
        <div className="hero-in">
          <div className="copy">
            <h1 className="h1">{headline.lead}<br /><span className="c">{headline.accent}</span><br /><span className="u">{headline.mark}</span></h1>
            <p className="lead">{c.lead}</p>
            <ul className="ffacts">
              {c.facts.map((f) => <li key={f.text}><Icon name={f.icon} className="ic" />{f.text}</li>)}
            </ul>
            <div className="actions">
              <A className="btn btn-brand" href={join.href}>{join.label}<Arrow /></A>
              {wa && <a className="btn btn-line" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Ask on WhatsApp</a>}
            </div>
            {trust && (
              <p className="trust">
                <span><Stars n={trust.stars} /><b>{trust.score}</b> · {trust.reviews}</span>
                <span className="sep" aria-hidden="true" />
                <span><b>{trust.placed.value}</b> {trust.placed.label}</span>
              </p>
            )}
          </div>

          {c.image ? (
            <div className="ha-media">
              <div className="ha-back shape" />
              <div className="ha-photo shape">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="photo" src={c.image.src} alt={c.image.alt} fetchPriority="high" />
                {c.imageTag && <div className="ha-tag"><span>{c.imageTag.text}</span><A href={c.imageTag.link.href}>{c.imageTag.link.label} <Arrow /></A></div>}
              </div>
            </div>
          ) : <div className="hero-art"><CeapArt /></div>}
        </div>

        {c.builtFor && (
          <>
            <h2 className="bf-t" id="au-for">{c.builtFor.title}</h2>
            <ul className="bf" aria-labelledby="au-for" data-reveal>
              {c.builtFor.items.map((p) => (
                <li key={p.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image.src} alt={p.image.alt} loading="lazy" />
                  <div className="ov"><div><small>{p.intro}</small><b>{p.label}</b></div><span className="to">→ {p.outcome}</span></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

function Program({ c, join, syllabus }: { c: NonNullable<Content['program']>; join: Join; syllabus?: string }) {
  return (
    <section className="sec panel panel-mist" id="program" aria-labelledby="au-prog">
      <div className="wrap">
        <div className="sh" data-reveal>
          <div><h2 className="h2" id="au-prog">{c.title}</h2><p className="lead">{c.lead}</p></div>
          {syllabus && <a className="tlink" href={syllabus}>Download the syllabus<Arrow /></a>}
        </div>
        <div data-reveal><Climb months={c.months} goal={c.goal} join={join} /></div>
      </div>
    </section>
  )
}

function How({ c }: { c: NonNullable<Content['how']> }) {
  const { certificate: cert } = c
  return (
    <section className="sec" id="how" aria-labelledby="au-how">
      <div className="wrap">
        <div className="sh" data-reveal><div><h2 className="h2" id="au-how">{c.title}</h2><p className="lead">{c.lead}</p></div></div>
        <div className="mosaic" data-reveal>
          {c.tiles.map((t, i) => (
            <figure key={t.title} className={`mz${i === 0 ? ' big' : i === 1 ? ' wide' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.image.src} alt={t.image.alt} loading="lazy" />
              <span className="mz-num" aria-hidden="true">{i + 1}</span>
              <figcaption className="mz-cap"><b>{t.title}</b><span>{t.line}</span></figcaption>
            </figure>
          ))}
          <figure className="mz cert">
            <span className="mz-num" aria-hidden="true">{c.tiles.length + 1}</span>
            <a className="cert-img" href={cert.image.src} target="_blank" rel="noopener noreferrer" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cert.image.src} width={1536} height={1024} alt={cert.image.alt} loading="lazy" />
            </a>
            <figcaption className="cert-cap"><b>{cert.title}</b><span>{cert.line}</span></figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}

function Placements({ c }: { c: NonNullable<Content['placements']> }) {
  // Two lanes, alternating people, so the same face is never on screen twice at once
  const cards = c.items.map((p) => (
    <li key={p.name} className="pc">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pc-pic" src={p.photo} alt="" width={112} height={112} loading="lazy" decoding="async" />
      <div className="pc-bd">
        <p className="pc-pkg"><b>₹{p.lpa}</b> LPA{p.city ? <span> · {p.city}</span> : null}</p>
        <h3 className="pc-name">{p.name}</h3>
        <p className="pc-co">
          {p.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="pc-logo" src={p.logo} alt={p.company} height={26} loading="lazy" decoding="async" />
            : p.company}
        </p>
        <p className="pc-role">{p.was ? `${p.was} → ` : ''}{p.now}</p>
      </div>
    </li>
  ))
  const lanes = [cards.filter((_, i) => i % 2 === 0), cards.filter((_, i) => i % 2 === 1)]
  return (
    <section className="sec panel panel-dark" id="placements" aria-labelledby="au-pl">
      <div className="wrap">
        <div className="sh" data-reveal>
          <div>
            <h2 className="h2" id="au-pl">{c.title}</h2>
            <p className="lead pl-sum">{c.stats.map((s) => <span key={s.label}><b>{s.value}</b> {s.label.toLowerCase()}</span>)}</p>
          </div>
          {c.link && <A className="tlink" href={c.link.href}>{c.link.label}<Arrow /></A>}
        </div>
      </div>
      {/* The lanes run the full width of the panel, so cards slide in from its edges */}
      <div data-reveal><StoryMarquee lanes={lanes} label="Placement stories" /></div>
    </section>
  )
}

function Trainers({ c }: { c: NonNullable<Content['trainers']> }) {
  return (
    <section className="sec" id="trainers" aria-labelledby="au-tr">
      <div className="wrap">
        <div className="sh" data-reveal><h2 className="h2" id="au-tr">{c.title}</h2></div>
        <div className="tgrid" data-reveal>
          {c.items.map((t) => (
            <article key={t.name} className="tr">
              <div className="ph">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.photo} alt="" loading="lazy" />
                <span className="yrs">{t.years} yrs</span>
                <div className="badges">{t.teaches.map((k) => <span key={k}><Logo name={k} label={LOGO_NAMES[k]} /></span>)}</div>
              </div>
              <h3 className="tn">
                <b>{t.name}</b>
                {t.linkedin && (
                  <a className="li" href={t.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${t.name} on LinkedIn`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#lg-linkedin" /></svg>
                  </a>
                )}
              </h3>
              <p className="role">{t.role}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Talk({ c, brand, join }: { c: NonNullable<Content['talk']>; brand: BrandInfo; join: Join }) {
  const { counsellor: p } = c
  const wa = p ? waLink(brand, p.message) : null
  const phone = brand.contact?.phone
  const card = Boolean(p && wa)
  return (
    <section className="sec panel panel-stone" id="talk" aria-labelledby="au-talk">
      <div className="wrap">
        <div className="sh" data-reveal><div><h2 className="h2" id="au-talk">{c.title}</h2><p className="lead">{c.lead}</p></div></div>
        <div className={`talk2${card ? '' : ' solo'}`} data-reveal>
          {p && wa && (
            <aside className="person2" aria-label="Talk to an admissions counsellor">
              <div className="p2-top">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo} alt="" width={56} height={56} loading="lazy" />
                <div><b>{p.name}</b><span>{p.role}</span></div>
              </div>
              <p className="p2-say">{p.line}</p>
              <a className="btn btn-brand" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Message {p.name.split(' ')[0]} on WhatsApp</a>
              {phone && <p className="p2-call">Or call <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>{p.hours ? ` · ${p.hours}` : ''}</p>}
            </aside>
          )}
          <div className="faq">
            {c.faq.map((q) => <details key={q.question}><summary>{q.question}</summary><p>{q.answer}</p></details>)}
          </div>
        </div>
        <div className="final" data-reveal>
          <div><b>{c.nextBatch.title}</b><span>{c.nextBatch.meta}</span></div>
          <A className="btn btn-accent" href={join.href}>{join.label}<Arrow /></A>
        </div>
      </div>
    </section>
  )
}

export function HomePage({ brand, content }: HomePageProps) {
  // No content supplied: show the plain fallback page instead of an empty design.
  if (!content) return <defaultTheme.HomePage brand={brand} />
  const wa = waLink(brand)
  const join = content.hero.primaryCta
  return (
    <div className="au">
      <Reveal />
      <Hero c={content.hero} join={join} wa={wa} />
      {content.program && <Program c={content.program} join={join} syllabus={content.syllabusHref} />}
      {content.how && <How c={content.how} />}
      {content.placements && <Placements c={content.placements} />}
      {content.trainers && <Trainers c={content.trainers} />}
      {content.talk && <Talk c={content.talk} brand={brand} join={join} />}
    </div>
  )
}

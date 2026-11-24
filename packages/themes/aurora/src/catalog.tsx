import type { CatalogPageProps } from '@educore/ui/theme'
import { WhatsAppIcon, waLink } from './parts'
import { CatalogGrid } from './catalog-grid'

export function CatalogPage({ brand, courses, terms }: CatalogPageProps) {
  const wa = waLink(brand)
  return (
    <article className="au">
      <section className="wrap cat-head">
        <h1 className="h1">{terms.courses} taught by <span className="u c">working engineers</span></h1>
        <p className="lead">Pick a platform and start with a free preview lesson where one is offered. No account needed to look around.</p>
      </section>
      <section className="wrap cat-sec">
        {courses.length === 0 ? (
          <div className="cat-empty">
            <h2 className="h3">New {terms.courses.toLowerCase()} are on the way</h2>
            <p className="body">Nothing is published yet.{wa ? ' Message us and a counsellor will tell you what starts next.' : ' Please check back soon.'}</p>
            {wa && <a className="btn btn-line" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Chat on WhatsApp</a>}
          </div>
        ) : (
          <CatalogGrid courses={courses} plural={terms.courses} />
        )}
        {courses.length > 0 && wa && (
          <p className="cat-help body">Not sure which one fits? <a className="tlink" href={wa} target="_blank" rel="noopener noreferrer">Ask a counsellor on WhatsApp</a></p>
        )}
      </section>
    </article>
  )
}

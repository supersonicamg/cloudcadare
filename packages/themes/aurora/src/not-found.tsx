import type { NotFoundPageProps } from '@educore/ui/theme'
import { A } from './parts'

/** A missing page, in the same look as the rest of the site: what happened, then the two places people want. */
export function NotFoundPage({ primary, secondary }: NotFoundPageProps) {
  return (
    <section className="cc cc-lost" aria-labelledby="lost-h">
      <div className="wrap">
        <h1 className="t-h2" id="lost-h">We could not find that page</h1>
        <p className="t-lead">The link may be old or mistyped, or the page may have moved.</p>
        <div className="act">
          {primary && <A className="btn" href={primary.href}>{primary.label}</A>}
          <A className="btn btn-line" href={secondary.href}>{secondary.label}</A>
        </div>
      </div>
    </section>
  )
}

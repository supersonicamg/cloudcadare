import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { istDate, type Enrolled } from '@/lib/dashboard'
import { courseAbbr, dateShort, timeShort } from '@/lib/format'
import type { MyEnrollment } from '@/lib/learn'
import { dayOfMonth, monthName, weekday } from '@/lib/live'
import { buttonLg } from '@/lib/ui'
import { ClassList } from '../_components/live'

const TEAMS_DOWNLOAD = 'https://www.microsoft.com/microsoft-teams/download-app'

/**
 * Home, when the seat is confirmed but the batch has not started (plan/16 §12, E3). One job: get ready for day one.
 * The filled button is the first free-preview lesson (the orientation) while it is unwatched. Ticks come from real
 * records only; links without a record (Teams, WhatsApp group) show a link mark instead of a tick.
 */
export function UpcomingHome({ d, lead, first }: { d: Enrolled; lead: MyEnrollment; first: string }) {
  const start = istDate(d.batch!.startDate!)
  const orientation = d.m.all.find((l) => l.isPreview && !l.lock) ?? null
  const classes = d.upcoming.slice(0, 3)
  const teams = d.sessions.some((s) => s.teams)
  const items = [
    { key: 'name', check: Boolean(d.certificateName), title: 'Confirm the name on your certificate', detail: d.certificateName ?? 'It is printed exactly as you type it', href: '/account', action: d.certificateName ? 'Change' : 'Add' },
    ...(orientation ? [{ key: 'orient', check: orientation.done, title: `Watch “${orientation.title}”`, detail: orientation.durationSeconds ? `${Math.max(1, Math.round(orientation.durationSeconds / 60))} min` : 'Free preview', href: `/learn/${lead.course.slug}/${orientation.id}`, action: 'Open' }] : []),
    ...(d.batch!.whatsappGroup ? [{ key: 'wa', check: null, title: 'Join your batch WhatsApp group', detail: 'Class links and reminders go here', href: d.batch!.whatsappGroup, action: 'Join' }] : []),
    ...(teams ? [{ key: 'teams', check: null, title: 'Install Microsoft Teams and sign in', detail: 'Phone or laptop. Classes run on Teams', href: TEAMS_DOWNLOAD, action: 'Get it' }] : []),
  ]
  const checkable = items.filter((i) => i.check !== null)
  const done = checkable.filter((i) => i.check).length

  return (
    <>
      <header className="lx-head">
        <div>
          <h1 className="lx-h1">You&apos;re in, {first}. See you on <em>{dateShort(start)}</em>.</h1>
          <p className="lx-lede">{courseAbbr(lead.course.title)} · {d.batch!.name}</p>
        </div>
        {orientation && !orientation.done && <Link href={`/learn/${lead.course.slug}/${orientation.id}`} className={`${buttonLg} max-[720px]:w-full`}>Watch the orientation<Icon name="chev" className="lx-i" /></Link>}
      </header>

      <section className="lx-card lx-hero" aria-label="Countdown" style={{ gridTemplateColumns: '96px minmax(0, 1fr)' }}>
        <span className="lx-date"><b>{dayOfMonth(start)}</b><span>{weekday(start)} · {monthName(start)}</span></span>
        <div>
          <h2>{d.startsIn} {d.startsIn === 1 ? 'day' : 'days'} to go</h2>
          <p className="when">{classes[0] ? `First class at ${timeShort(classes[0].startsAt)}${teams ? ' on Teams' : ''}. ` : ''}{d.batch!.schedule ? `Classes ${d.batch!.schedule}.` : ''}</p>
        </div>
      </section>

      <div className={classes.length ? 'lx-two even' : 'grid'}>
        <section className="lx-card" aria-labelledby="ready-h">
          <div className="lx-sec-h" style={{ paddingBottom: 12 }}>
            <h2 className="lx-h2" id="ready-h">Before {dateShort(start)}</h2>
            <span className="lx-meta">{done} of {checkable.length} done</span>
          </div>
          <ul className="lx-todo">
            {items.map((i) => (
              <li key={i.key} className={i.check ? 'dn' : undefined}>
                {i.check === null
                  ? <span className="lx-st link"><Icon name="link" /></span>
                  : <span className={`lx-st${i.check ? ' ok' : ''}`}>{i.check && <Icon name="check" />}<span className="sr-only">{i.check ? 'Done' : 'To do'}</span></span>}
                <span><b>{i.title}</b><span className="d">{i.detail}</span></span>
                {i.href.startsWith('/')
                  ? <Link href={i.href} className="lx-link" aria-label={`${i.action}: ${i.title}`}>{i.action}</Link>
                  : <a href={i.href} target="_blank" rel="noopener noreferrer" className="lx-link" aria-label={`${i.action}: ${i.title}`}>{i.action}</a>}
              </li>
            ))}
          </ul>
        </section>
        {classes.length > 0 && (
          <section className="lx-card" aria-labelledby="first-h">
            <div className="lx-sec-h" style={{ paddingBottom: 6 }}>
              <h2 className="lx-h2" id="first-h">First classes</h2>
              <span className="lx-meta">{teams ? 'On Microsoft Teams' : ''}</span>
            </div>
            <ClassList sessions={classes} />
          </section>
        )}
      </div>

      {d.months.length > 0 && (
        <section className="lx-sec" aria-labelledby="months-h">
          <div className="lx-sec-h"><h2 className="lx-h2" id="months-h">Your {d.months.length} months</h2><span className="lx-meta">Month 1 opens on {dateShort(start)}</span></div>
          <ol className="lx-card stone lx-months" aria-label="Months of the program">
            {d.months.map((mo) => (
              <li key={mo.id}>
                <div className="row">
                  <span className="n">{mo.number}</span>
                  <span className="t">{mo.title}</span>
                  <span className="c">{mo.opensOn ? `Opens ${mo.opensOn}` : `${mo.total} lessons`}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}

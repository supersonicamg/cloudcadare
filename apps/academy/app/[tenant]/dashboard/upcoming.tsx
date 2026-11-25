import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { istDate, type Enrolled } from '@/lib/dashboard'
import { courseAbbr, dateShort, timeShort } from '@/lib/format'
import type { MyEnrollment } from '@/lib/learn'
import { dayOfMonth, monthName, weekday } from '@/lib/live'
import { buttonLg, buttonOutline } from '@/lib/ui'
import { ClassList } from '../_components/live'
import { Climb } from './climb'

const TEAMS_DOWNLOAD = 'https://www.microsoft.com/microsoft-teams/download-app'

/**
 * Seat confirmed, batch not started (plan/16 §12, E3). One job: get ready for day one. The filled button is the first
 * free-preview lesson (the orientation) while it is unwatched. Ticks come from real records only; links without a record
 * (Teams, WhatsApp group) show no tick.
 */
export function UpcomingDashboard({ d, lead, first, whatsapp, goal }: { d: Enrolled; lead: MyEnrollment; first: string; whatsapp: string | null; goal?: string }) {
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
      <section aria-labelledby="dash-h" className="ld-s tight">
        <div className="ld-wrap flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="grid gap-[22px]">
            <div className="ld-hi">
              <h1 id="dash-h" className="ld-h1">You&apos;re in, {first}. See you on <em>{dateShort(start)}</em>.</h1>
              <p className="ld-meta">{courseAbbr(lead.course.title)} · {d.batch!.name}</p>
            </div>
            <div className="ld-count">
              <span className="ld-date"><b>{dayOfMonth(start)}</b><span>{weekday(start)} · {monthName(start)}</span></span>
              <p><b>{d.startsIn} {d.startsIn === 1 ? 'day' : 'days'} to go</b>{classes[0] ? `First class at ${timeShort(classes[0].startsAt)}${teams ? ' on Teams' : ''}.` : ''} {d.batch!.schedule ? `Classes ${d.batch!.schedule}.` : ''}</p>
            </div>
          </div>
          {orientation && !orientation.done && <Link href={`/learn/${lead.course.slug}/${orientation.id}`} className={`${buttonLg} max-[820px]:w-full`}>Watch the orientation <span aria-hidden="true">→</span></Link>}
        </div>
      </section>

      <section aria-label="Get ready" className="ld-panel ld-s">
        <div className="ld-wrap">
          <div className={classes.length ? 'ld-2' : 'grid'}>
            <div className="ld-card ld-pad">
              <div className="ld-wh"><h2 className="ld-h3">Before {dateShort(start)}</h2><span className="m">{done} of {checkable.length} done</span></div>
              <ul className="ld-check">
                {items.map((i) => (
                  <li key={i.key} className={i.check ? 'dn' : undefined}>
                    {i.check === null
                      ? <span className="st none"><Icon name="link" className="h-[18px] w-[18px]" /></span>
                      : <span className={`st${i.check ? ' ok' : ''}`}>{i.check && <Icon name="check" className="h-3.5 w-3.5" />}<span className="sr-only">{i.check ? 'Done' : 'To do'}</span></span>}
                    <span><b>{i.title}</b><span className="d">{i.detail}</span></span>
                    {i.href.startsWith('/')
                      ? <Link href={i.href} className="ld-link" aria-label={`${i.action}: ${i.title}`}>{i.action}</Link>
                      : <a href={i.href} target="_blank" rel="noopener noreferrer" className="ld-link" aria-label={`${i.action}: ${i.title}`}>{i.action}</a>}
                  </li>
                ))}
              </ul>
            </div>
            {classes.length > 0 && (
              <div className="ld-card ld-pad">
                <div className="ld-wh"><h2 className="ld-h3">Scheduled classes</h2><span className="m">First classes{teams ? ', on Teams' : ''}</span></div>
                <div className="mt-3"><ClassList sessions={classes} /></div>
              </div>
            )}
          </div>
          {whatsapp && <div className="mt-6"><a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonOutline}>Ask us on WhatsApp</a></div>}
        </div>
      </section>

      {d.months.length > 0 && (
        <section aria-labelledby="months-h" className="ld-panel mist ld-s">
          <div className="ld-wrap">
            <div className="ld-head"><div><h2 id="months-h" className="ld-h2">Your {d.months.length} months</h2><p>Month 1 opens on {dateShort(start)}.</p></div></div>
            <Climb label="Months of the program" goal={goal} steps={d.months.map((mo) => ({ key: mo.id, number: mo.number, title: mo.title, state: 'locked', detail: mo.opensOn ? `Opens ${mo.opensOn}` : `${mo.total} lessons` }))} />
          </div>
        </section>
      )}
    </>
  )
}

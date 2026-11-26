import Link from 'next/link'
import { istDate, type Enrolled } from '@/lib/dashboard'
import { courseAbbr, dateShort } from '@/lib/format'
import type { MyEnrollment } from '@/lib/learn'
import { ClassList } from '../_components/live'
import { Ic, Wa } from '../_components/v11'
import { Cal, MonthCards, Week, type MonthCardData } from './parts'

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
    ...(orientation ? [{ key: 'orient', check: orientation.done, title: `Watch “${orientation.title}”`, detail: orientation.durationSeconds ? `Free lesson · ${Math.max(1, Math.round(orientation.durationSeconds / 60))} min` : 'Free lesson', href: `/learn/${lead.course.slug}/${orientation.id}`, action: 'Open' }] : []),
    ...(d.batch!.whatsappGroup ? [{ key: 'wa', check: null, title: 'Join your batch WhatsApp group', detail: 'Class links and reminders go here', href: d.batch!.whatsappGroup, action: 'Join' }] : []),
    ...(teams ? [{ key: 'teams', check: null, title: 'Install Microsoft Teams and sign in', detail: 'Phone or laptop. Classes run on Teams', href: TEAMS_DOWNLOAD, action: 'Get it' }] : []),
  ]
  const checkable = items.filter((i) => i.check !== null)
  const done = checkable.filter((i) => i.check).length
  const labs = (i: number) => d.m.months[i]?.lessons.filter((l) => l.type === 'lab').length ?? 0
  const months: MonthCardData[] = d.months.map((m, i) => ({
    id: m.id, title: m.title, state: 'open',
    note: m.opensOn ? `opens ${m.opensOn}` : undefined,
    line: `${m.total} ${m.total === 1 ? 'lesson' : 'lessons'}${labs(i) ? ` · ${labs(i)} ${labs(i) === 1 ? 'lab' : 'labs'}` : ''}`,
  }))

  return (
    <>
      <div className="pg-h">
        <div>
          <h1 className="t-title">You&apos;re in, {first}. See you on {dateShort(start)}.</h1>
          <p className="t-lead">{courseAbbr(lead.course.title)} · {d.batch!.name}</p>
        </div>
        {orientation && !orientation.done && <Link href={`/learn/${lead.course.slug}/${orientation.id}`} className="btn">Watch the orientation</Link>}
      </div>

      <div className="band">
        <div className={`ticket${d.batch!.days.length ? ' two' : ''}`}>
          <Cal start={start} foot={<><b>{d.startsIn} {d.startsIn === 1 ? 'day' : 'days'}</b> to go</>} />
          <Week batch={d.batch!} teams={teams} />
        </div>
      </div>

      <div className={`${classes.length ? 'two ' : ''}blk`}>
        <section aria-labelledby="ready-h">
          <div className="blk-h"><h2 className="t-h3" id="ready-h">Before {dateShort(start)}</h2><p className="t-small"><b>{done} of {checkable.length}</b> done</p></div>
          <ul className="todo rows">
            {items.map((i) => {
              const label = `${i.action}: ${i.title}`
              return (
                <li key={i.key}>
                  {i.check === null
                    ? <span className="ck lnk">{i.key === 'wa' ? <Wa /> : <Ic n="live" s />}</span>
                    : <span className={`ck${i.check ? ' on' : ''}`}>{i.check && <Ic n="check" s />}<span className="sr">{i.check ? 'Done' : 'To do'}</span></span>}
                  <span className="tx"><b className="t-card">{i.title}</b><span>{i.detail}</span></span>
                  {i.href.startsWith('/')
                    ? <Link href={i.href} className="link link-s" aria-label={label}>{i.action}</Link>
                    : <a href={i.href} target="_blank" rel="noopener noreferrer" className="link link-s" aria-label={label}>{i.action}</a>}
                </li>
              )
            })}
          </ul>
        </section>
        {classes.length > 0 && (
          <section aria-labelledby="first-h">
            <div className="blk-h"><h2 className="t-h3" id="first-h">First classes</h2>{teams && <p className="t-small">On Microsoft Teams</p>}</div>
            <ClassList sessions={classes} rows />
          </section>
        )}
      </div>

      {months.length > 0 && (
        <section className="blk" aria-labelledby="mo2-h">
          <div className="blk-h"><h2 className="t-h3" id="mo2-h">Your {months.length} months</h2><p className="t-small">Month 1 opens on {dateShort(start)}</p></div>
          <MonthCards months={months} />
        </section>
      )}
    </>
  )
}

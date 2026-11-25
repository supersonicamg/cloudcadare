import Link from 'next/link'
import { Icon, type IconName } from '@educore/ui/marks'
import { buttonOutline, buttonSm } from '@/lib/ui'
import { money } from '@/lib/money'
import { ConfirmButton } from '../../_components/confirm'
import { setCourseStatus } from '../actions'
import { minutesText } from './outline'

export interface Sale { status: string; price: number | null; compareAt: number | null; gst: boolean }

function Fact({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return <li className="flex items-center gap-3 t-label !text-fg"><Icon name={icon} className="h-5 w-5 shrink-0 text-primary" /> {children}</li>
}

/** The state of the course in one place: is it live, is it ready, what does it cost, where to jump. */
export function Glance({ id, slug, published, canPublish, manage, stats, months, sale, commerceOn, base, filtered }: {
  id: string; slug: string; published: boolean; canPublish: boolean; manage: boolean
  stats: { lessons: number; ready: number; seconds: number }
  months: { id: string; title: string; lessons: number; need: number }[]
  sale: Sale | null; commerceOn: boolean; base: string; filtered: boolean
}) {
  const need = stats.lessons - stats.ready
  const pct = stats.lessons ? Math.round((stats.ready / stats.lessons) * 100) : 0
  const selling = sale?.status === 'published' && sale.price !== null

  return (
    <aside aria-label="Course summary" className="grid content-start gap-4 lg:sticky lg:top-6">
      <section className="rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,31,.06)] ring-1 ring-border">
        <p className="t-label !text-fg">{stats.lessons ? (need ? 'Lessons with content' : 'Every lesson has its content') : 'No lessons yet'}</p>
        {stats.lessons > 0 && (
          <>
            <p className="mt-2 flex items-baseline gap-2"><span className="t-num">{stats.ready}</span><span className="t-body tnum">of {stats.lessons}</span></p>
            <div role="progressbar" aria-label="Lessons with content" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
        {need > 0 && (
          <p className="mt-3 t-small">
            {need === 1 ? '1 lesson is' : `${need} lessons are`} still empty.{' '}
            <Link href={filtered ? base : `${base}?show=empty`} className="inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4">{filtered ? 'Show all lessons' : 'Show only these'}</Link>
          </p>
        )}

        <ul className="mt-4 grid gap-3 border-t border-border pt-4">
          <Fact icon="calendar">{months.length === 1 ? '1 month or topic' : `${months.length} months or topics`}</Fact>
          {stats.seconds > 0 && <Fact icon="clock">{minutesText(stats.seconds)} of lessons</Fact>}
          {commerceOn && (
            <Fact icon="briefcase">
              {selling ? <>{money(sale!.price!)}{sale!.compareAt ? <s className="ml-1 text-mute">{money(sale!.compareAt)}</s> : null}</> : 'Not on sale'}
              <Link href={`${base}?tab=price`} className="ml-auto inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4">{selling ? 'Change' : 'Set a price'}</Link>
            </Fact>
          )}
        </ul>

        <div className="mt-4 grid gap-3 border-t border-border pt-4">
          {published ? (
            <>
              <p className="t-small">People can see this course on your website.</p>
              <Link href={`/courses/${slug}`} className={`${buttonOutline} w-full`}>See it on the website</Link>
              {manage && (
                <ConfirmButton action={setCourseStatus.bind(null, id, 'draft')} label="Hide from website" yes="Yes, hide it"
                  question="Hide this course? New people will not see it or be able to buy it." />
              )}
            </>
          ) : (
            <>
              <p className="t-small">Only your team can see this course. Nobody can join until you publish it.</p>
              {canPublish && <form action={setCourseStatus.bind(null, id, 'published')}><button className={`${buttonSm} w-full`}>Publish</button></form>}
            </>
          )}
        </div>
      </section>

      {!filtered && months.length > 1 && (
        <nav aria-label="Jump to a month" className="hidden rounded-[20px] bg-white p-3 ring-1 ring-border lg:block">
          <p className="px-3 pb-1 pt-2 t-label !text-fg">Jump to</p>
          <ul>
            {months.map((m, i) => (
              <li key={m.id}>
                <a href={`#month-${m.id}`} className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 t-label hover:bg-muted hover:!text-fg">
                  <span className="grid size-6 place-items-center rounded-md bg-[#E4EFEB] text-[13px] font-bold text-primary tnum">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  {m.need > 0 && <span className="rounded-full bg-accent px-2 text-[13px] font-bold tabular-nums text-fg">{m.need}<span className="sr-only"> need content</span></span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  )
}

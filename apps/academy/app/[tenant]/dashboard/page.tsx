import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { getEnrolled, getJoinState } from '@/lib/dashboard'
import { getMyEnrollments } from '@/lib/learn'
import { getShell } from '@/lib/shell'
import { EnrolledDashboard } from './enrolled'
import { NoCourseDashboard } from './join'
import { UpcomingDashboard } from './upcoming'
import '../_components/learner.css'

export const metadata: Metadata = { title: 'Dashboard' }

/*
 * The signed-in default page (plan/16 §12). It is never empty: a running course, a course that has not started, a seat
 * waiting to be claimed, a payment being checked, or the way to join.
 */
const LIVE: Record<string, string> = {
  early: 'The class link opens 10 minutes before the start.',
  over: 'That class has ended. The recording appears under Recorded classes.',
  unavailable: 'That link is not available right now. Message us and we will help.',
}

export default async function Dashboard({ searchParams }: PageProps<'/[tenant]/dashboard'>) {
  const a = await requireMember('/dashboard')
  const [{ theme, brand, nav, account, site, home, bundle }, enrollments, sp] = await Promise.all([getShell(), getMyEnrollments(a), searchParams])
  const lead = enrollments.find((e) => e.status === 'active') ?? enrollments[0]
  const first = (a.memberName || '').split(/\s+/)[0] || 'there'
  const digits = (brand.contact?.whatsapp ?? '').replace(/\D/g, '')
  const whatsapp = digits.length >= 8 ? `https://wa.me/${digits}` : null
  const d = lead ? await getEnrolled(a, lead) : null

  const live = typeof sp.live === 'string' ? LIVE[sp.live] : undefined
  const message = sp.paid ? <>Payment received. Your course is ready, and your receipt is in <Link href="/account/payments">Payments and receipts</Link>.</>
    : sp.joined === '0' ? 'We could not open your batch just now. Try again, or message us.'
    : live ?? null

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <div className="ld">
        {message && (
          <div className="ld-wrap pt-6"><p role="status" className={`ld-note${sp.paid ? ' good' : ''}`}><Icon name={sp.paid ? 'check' : 'info'} className="mt-0.5 h-5 w-5 shrink-0" /><span>{message}</span></p></div>
        )}
        {lead && d ? (
          d.startsIn > 0 && d.batch?.startDate
            ? <UpcomingDashboard d={d} lead={lead} first={first} whatsapp={whatsapp} goal={home?.program?.goal} />
            : <EnrolledDashboard d={d} lead={lead} first={first} joined={sp.joined === '1'} x={{
                notes: isEnabled(bundle.features, 'learning.notes'), certificates: isEnabled(bundle.features, 'learning.certificates'),
                syllabusHref: home?.syllabusHref, goal: home?.program?.goal, whatsapp, others: enrollments.filter((e) => e !== lead),
              }} />
        ) : (
          <NoCourseDashboard s={await getJoinState(a)} first={first} whatsapp={whatsapp} checkout={isEnabled(bundle.features, 'commerce.checkout')} syllabusHref={home?.syllabusHref} goal={home?.program?.goal} />
        )}
      </div>
    </theme.SiteLayout>
  )
}

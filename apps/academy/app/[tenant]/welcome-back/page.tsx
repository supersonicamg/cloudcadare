import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { dateLong } from '@/lib/format'
import { getShell } from '@/lib/shell'
import { buttonLg, h1s, lead } from '@/lib/ui'

export const metadata = { title: 'Welcome back' }

/*
 * A4 · Welcome back (the learner's email was on the learner list).
 * 1. One job: say plainly that access is already there and nothing is to be paid.
 * 2. One main action: "Go to my course".
 * 3. Reading order: tick tile (the one yellow thing) -> "Welcome back, Rohit." -> one sentence -> two facts
 *    (batch, access until) -> the button -> a small WhatsApp line for anyone whose dates look wrong.
 * Reading this page changes nothing, so refreshing it never makes a second enrolment.
 */
export default async function WelcomeBack() {
  const a = await requireMember('/welcome-back')
  const [{ theme, brand, nav, account, site }, { data: rows }] = await Promise.all([
    getShell(),
    a.db.from('enrollments').select('expires_at, started_at, courses(title, slug), batches(name)')
      .eq('member_id', a.memberId).eq('source', 'import').in('status', ['active', 'paused', 'completed']).order('started_at', { ascending: false }).limit(1),
  ])
  const row = rows?.[0]
  if (!row) redirect('/learn')
  const course = Array.isArray(row.courses) ? row.courses[0] : row.courses
  const batch = Array.isArray(row.batches) ? row.batches[0] : row.batches
  const wa = brand.contact?.whatsapp?.replace(/\D/g, '')
  const waHref = wa && wa.length >= 8 ? `https://wa.me/${wa}?text=${encodeURIComponent('Hi, my batch or access dates look wrong.')}` : null
  const first = a.memberName.split(' ')[0]

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <section aria-labelledby="wb-h" className="mx-auto flex max-w-[640px] flex-col items-start gap-6 px-5 pb-24 pt-12 md:pt-20">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-fg"><Icon name="check" className="h-8 w-8" /></span>
        <div className="grid gap-3">
          <h1 id="wb-h" className={h1s}>Welcome back, <span className="text-primary">{first}.</span></h1>
          <p className={lead}>Your email is on our learner list, so {course?.title ?? 'your course'} is already unlocked. Nothing to pay.</p>
        </div>
        <ul className="t-label flex flex-wrap gap-x-8 gap-y-2 !text-fg">
          {batch?.name && <li className="flex items-center gap-2"><Icon name="calendar" className="h-5 w-5 text-primary" />{batch.name}</li>}
          <li className="flex items-center gap-2"><Icon name="clock" className="h-5 w-5 text-primary" />{row.expires_at ? `Access until ${dateLong(row.expires_at)}` : 'No end date'}</li>
        </ul>
        <Link href={course?.slug ? `/learn/${course.slug}` : '/learn'} className={`${buttonLg} w-full sm:w-auto`}>Go to my course <span aria-hidden="true">→</span></Link>
        {waHref && <p className="t-small">Dates look wrong? <a href={waHref} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">Tell us on WhatsApp</a>.</p>}
      </section>
    </theme.SiteLayout>
  )
}

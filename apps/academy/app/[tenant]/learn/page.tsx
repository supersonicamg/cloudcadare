import Link from 'next/link'
import { Suspense } from 'react'
import { Icon, Logo, platformFor } from '@educore/ui/marks'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { getMyEnrollments, type MyEnrollment } from '@/lib/learn'
import { getShell, TERMS } from '@/lib/shell'
import { bannerClass, buttonLg, buttonQuiet, h1s, h2s } from '@/lib/ui'
import { ProgressBar } from './_components/curriculum'

export const metadata = { title: 'My learning' }

const startOrContinue = (e: MyEnrollment) => (e.status === 'completed' ? 'Review' : e.lessonsCompleted > 0 || e.lastLessonId ? 'Continue' : 'Start')
const hrefFor = (e: MyEnrollment) => (e.lastLessonId ? `/learn/${e.course.slug}/${e.lastLessonId}` : `/learn/${e.course.slug}`)

function Tile({ e, size }: { e: MyEnrollment; size: 'lg' | 'sm' }) {
  const logo = platformFor(e.course.title)
  const box = size === 'lg' ? 'h-[72px] w-[72px] rounded-[20px] bg-white' : 'h-[52px] w-[52px] rounded-[14px] border border-border bg-white'
  return (
    <span className={`grid shrink-0 place-items-center ${box}`}>
      {logo ? <Logo name={logo} className={size === 'lg' ? 'h-[46px] w-[46px]' : 'h-8 w-8'} /> : <Icon name="book" className={size === 'lg' ? 'h-9 w-9' : 'h-6 w-6'} />}
    </span>
  )
}

async function PaidBanner({ searchParams }: { searchParams: PageProps<'/[tenant]/learn'>['searchParams'] }) {
  const { paid } = await searchParams
  if (!paid) return null
  return (
    <p role="status" className={`${bannerClass('ok')} mb-[26px]`}>
      <Icon name="check" className="h-[22px] w-[22px] shrink-0" />
      <span>Payment received. Your course is ready, and your receipt is in <Link href="/account/payments" className="underline">Payments and receipts</Link>.</span>
    </p>
  )
}

export default async function MyLearning(props: PageProps<'/[tenant]/learn'>) {
  const a = await requireMember('/learn')
  const [{ theme, brand, nav, account, site, bundle }, enrollments] = await Promise.all([getShell(), getMyEnrollments(a)])
  const lead = enrollments.find((e) => e.status === 'active')
  const others = enrollments.filter((e) => e !== lead)
  const certs = isEnabled(bundle.features, 'learning.certificates')

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <section className="mx-auto max-w-[1000px] px-5 pb-20 pt-8 md:pt-10">
        <Suspense fallback={null}><PaidBanner searchParams={props.searchParams} /></Suspense>
        <h1 className={h1s}>My learning</h1>
        <p className="mt-2 text-[17px] text-grey">Signed in as {a.memberName}.</p>

        {enrollments.length === 0 ? (
          <div className="mt-7 grid items-center gap-6 rounded-[28px] bg-tint-2 p-6 md:grid-cols-[1fr_auto] md:p-10">
            <div>
              <h2 className={h2s}>You’re not enrolled in any {TERMS.course.toLowerCase()} yet</h2>
              <p className="mt-2.5 text-[17px] text-grey">Browse the {TERMS.courses.toLowerCase()} and start with one that fits.</p>
            </div>
            <Link href="/courses" className={buttonLg}>Browse {TERMS.courses.toLowerCase()}</Link>
          </div>
        ) : (
          <>
            {lead && (
              <div className="mt-7 grid items-center gap-x-7 gap-y-5 rounded-[28px] bg-tint-1 p-6 md:p-8 sm:grid-cols-[auto_1fr_auto] max-sm:grid-cols-[auto_1fr]">
                <Tile e={lead} size="lg" />
                <div>
                  <p className="text-[15px] font-semibold text-primary">{lead.lessonsCompleted > 0 || lead.lastLessonId ? 'Pick up where you left off' : 'Start here'}</p>
                  <h2 className="mt-0.5 font-heading text-[26px] font-bold leading-tight tracking-[-0.03em]">
                    <Link href={`/learn/${lead.course.slug}`}>{lead.course.title}</Link>
                  </h2>
                  {lead.course.subtitle && <p className="mt-1.5 text-base text-[#3C4746]">{lead.course.subtitle}</p>}
                  <ProgressBar pct={lead.progressPct} label={`${lead.course.title} progress`} className="mt-[18px] max-w-[460px] !bg-white/70" />
                  <p className="mt-2 text-sm text-[#3C4746]">{`${lead.lessonsCompleted} of ${lead.lessonsTotal} lessons`} · {Math.round(lead.progressPct)}%</p>
                </div>
                <Link href={hrefFor(lead)} className={`${buttonLg} max-sm:col-span-full`}>{startOrContinue(lead)} <span aria-hidden="true">→</span></Link>
              </div>
            )}
            {others.length > 0 && (
              <div className="mt-9">
                {lead && <h2 className="text-sm font-semibold text-mute">Other {TERMS.courses.toLowerCase()}</h2>}
                <ul className={`${lead ? 'mt-2.5' : ''} border-t-2 border-fg`}>
                  {others.map((e) => {
                    const finished = e.status === 'completed'
                    return (
                      <li key={e.id} className="grid items-center gap-x-[22px] gap-y-2 border-b border-border py-[22px] grid-cols-[auto_1fr_auto] max-sm:grid-cols-[auto_1fr]">
                        <Tile e={e} size="sm" />
                        <div>
                          <b className="block text-[19px] font-semibold tracking-tight"><Link href={`/learn/${e.course.slug}`}>{e.course.title}</Link></b>
                          <ProgressBar pct={e.progressPct} label={`${e.course.title} progress`} className="mt-2.5 max-w-[320px] !h-2" />
                          <p className="mt-1.5 text-sm text-mute">
                            {finished ? 'Completed' : `${e.lessonsCompleted} of ${e.lessonsTotal} lessons`} · {Math.round(e.progressPct)}%
                            {finished && certs && <> · <Link href="/certificates" className="font-semibold text-primary underline">View certificate</Link></>}
                          </p>
                        </div>
                        <Link href={hrefFor(e)} className={`${buttonQuiet} max-sm:col-span-full max-sm:justify-self-start`}>{startOrContinue(e)}</Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </theme.SiteLayout>
  )
}

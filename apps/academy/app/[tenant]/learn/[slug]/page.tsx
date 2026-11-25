import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { Icon, Logo, platformFor } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { getLearnCourse } from '@/lib/learn'
import { getShell } from '@/lib/shell'
import { backLink, buttonLg, h1s } from '@/lib/ui'
import { Curriculum, ProgressBar } from '../_components/curriculum'

export const metadata: Metadata = { title: 'Course' }

export default async function LearnCourse({ params }: PageProps<'/[tenant]/learn/[slug]'>) {
  const { slug } = await params
  const a = await requireMember(`/learn/${slug}`)
  const [{ theme, brand, nav, account, site, bundle }, course] = await Promise.all([getShell(), getLearnCourse(a, slug)])
  if (!course) notFound()
  const { enrollment: e, resume } = course
  const finished = e.status === 'completed'
  const logo = platformFor(e.course.title)
  const certs = isEnabled(bundle.features, 'learning.certificates')

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <article className="mx-auto max-w-[1360px] px-[clamp(20px,5.5vw,80px)] pb-20 pt-6 md:pt-9">
        <Link href="/learn" className={backLink}><Icon name="back" />My learning</Link>
        <div className="mb-[34px] mt-[22px] flex items-center gap-[18px]">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] border border-border bg-white">
            {logo ? <Logo name={logo} className="h-10 w-10" /> : <Icon name="book" className="h-8 w-8" />}
          </span>
          <div>
            <h1 className={h1s}>{e.course.title}</h1>
            {e.course.subtitle && <p className="mt-1.5 text-sm text-mute">{e.course.subtitle}</p>}
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16">
          <div>
            {course.order.length === 0
              ? <p className="text-lg text-grey">Lessons will appear here once they are published.</p>
              : <Curriculum slug={slug} sections={course.sections} upNextId={finished ? undefined : resume?.id} />}
          </div>
          <aside className="flex flex-col gap-[18px] rounded-3xl border border-border bg-white p-6 lg:sticky lg:top-6">
            <div>
              <p className="text-sm text-mute">Your progress</p>
              <p className="mt-1.5 font-heading text-[40px] font-extrabold leading-none tracking-[-0.045em]">
                {e.lessonsCompleted} <span className="text-xl font-semibold tracking-[-0.02em] text-mute">of {e.lessonsTotal} lessons</span>
              </p>
              <ProgressBar pct={e.progressPct} label="Course progress" className="mt-3.5" />
              <p className="mt-2 text-sm text-mute">
                {finished ? 'Course completed' : `${e.lessonsCompleted} of ${e.lessonsTotal} lessons`} · {Math.round(e.progressPct)}%
              </p>
            </div>
            {resume && (
              <Link href={`/learn/${slug}/${resume.id}`} className={`${buttonLg} w-full`}>
                {finished ? 'Review from the start' : e.lessonsCompleted > 0 ? 'Continue' : 'Start'} <span aria-hidden="true">→</span>
              </Link>
            )}
            {certs && !finished && (
              <p className="flex items-start gap-3.5 border-t border-border pt-[18px] text-[15px] leading-snug text-grey">
                <Icon name="medal" className="h-[26px] w-[26px] shrink-0 text-primary" />
                <span>Finish all {e.lessonsTotal} lessons to earn your certificate.</span>
              </p>
            )}
          </aside>
        </div>
      </article>
    </theme.SiteLayout>
  )
}

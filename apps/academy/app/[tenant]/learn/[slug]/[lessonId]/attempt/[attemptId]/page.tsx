import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/lib/dal'
import { getLearnCourse } from '@/lib/learn'
import { getShell } from '@/lib/shell'
import { LearnerShell } from '../../../../../_components/learner-shell'
import { placeOf } from '../../../../_components/lesson-meta'
import '../../../../_components/study.css'
import { QuizRunner, type Paper } from './quiz-runner'

export const metadata: Metadata = { title: 'Quiz' }

export default async function Attempt({ params }: PageProps<'/[tenant]/learn/[slug]/[lessonId]/attempt/[attemptId]'>) {
  const { slug, lessonId, attemptId } = await params
  if (!z.uuid().safeParse(lessonId).success || !z.uuid().safeParse(attemptId).success) notFound()
  const a = await requireMember(`/learn/${slug}/${lessonId}/attempt/${attemptId}`)
  const courseHome = getLearnCourse(a, slug)
  const shell = await getShell()

  // The database hands over the paper without answer keys, and only while the attempt is open and is the caller's own.
  const { data, error } = await a.db.rpc('get_attempt_paper', { p_attempt_id: attemptId })
  if (error) {
    if (error.message.includes('attempt_closed')) redirect(`/learn/${slug}/${lessonId}/result/${attemptId}`)
    notFound()
  }
  const paper = data as unknown as Paper
  const place = placeOf((await courseHome)?.sections, lessonId)

  return (
    <LearnerShell a={a} shell={shell} active="lessons" focus={{ backHref: `/learn/${slug}/material`, backLabel: 'My course', where: `${place ? `${place.label} · ` : ''}${paper.test.title}` }}>
      <QuizRunner paper={paper} resultHref={`/learn/${slug}/${lessonId}/result/${attemptId}`} />
    </LearnerShell>
  )
}

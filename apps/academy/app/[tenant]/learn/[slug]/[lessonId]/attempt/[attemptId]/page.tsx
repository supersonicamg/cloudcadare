import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/lib/dal'
import { getShell } from '@/lib/shell'
import { QuizRunner, type Paper } from './quiz-runner'

export const metadata: Metadata = { title: 'Quiz' }

export default async function Attempt({ params }: PageProps<'/[tenant]/learn/[slug]/[lessonId]/attempt/[attemptId]'>) {
  const { slug, lessonId, attemptId } = await params
  if (!z.uuid().safeParse(lessonId).success || !z.uuid().safeParse(attemptId).success) notFound()
  const a = await requireMember(`/learn/${slug}/${lessonId}/attempt/${attemptId}`)
  const { theme, brand } = await getShell()

  // The database hands over the paper without answer keys, and only while the attempt is open and is the caller's own.
  const { data, error } = await a.db.rpc('get_attempt_paper', { p_attempt_id: attemptId })
  if (error) {
    if (error.message.includes('attempt_closed')) redirect(`/learn/${slug}/${lessonId}/result/${attemptId}`)
    notFound()
  }
  const paper = data as unknown as Paper

  return (
    <theme.FocusLayout brand={brand}>
      <QuizRunner paper={paper} resultHref={`/learn/${slug}/${lessonId}/result/${attemptId}`} exitHref={`/learn/${slug}/${lessonId}`} />
    </theme.FocusLayout>
  )
}

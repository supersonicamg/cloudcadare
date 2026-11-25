import { redirect } from 'next/navigation'

// The old curriculum list is now "Course material" (plan/16 B2): months, filters and search on one screen.
export default async function LearnCourse({ params }: PageProps<'/[tenant]/learn/[slug]'>) {
  const { slug } = await params
  redirect(`/learn/${slug}/material`)
}

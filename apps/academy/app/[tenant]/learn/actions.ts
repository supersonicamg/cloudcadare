'use server'

import { redirect } from 'next/navigation'
import { ActionDenied, requireMemberAction } from '@/lib/dal'

/** "Enrol for free" on a course page. The tenant comes from the Host header; the database decides if it is allowed. */
export async function enrolInCourse(courseId: string, slug: string, _form: FormData): Promise<void> {
  let target = `/learn/${slug}`
  try {
    const a = await requireMemberAction()
    const { error } = await a.db.rpc('enroll_in_course', { p_course_id: courseId })
    // Back to the course page: if enrolment closed meanwhile, its button now says so.
    if (error) target = `/courses/${slug}`
  } catch (e) {
    if (!(e instanceof ActionDenied)) throw e
    target = `/login?next=${encodeURIComponent(`/courses/${slug}`)}`
  }
  redirect(target)
}

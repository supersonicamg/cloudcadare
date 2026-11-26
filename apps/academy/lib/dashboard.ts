import 'server-only'
import { cachedCourse, cachedCourses } from '@/lib/catalog'
import type { Access } from '@/lib/dal'
import { emailCodeRequired } from '@/lib/email-code'
import { dateShort, nowMs, timeShort } from '@/lib/format'
import type { MyEnrollment } from '@/lib/learn'
import { getClassSessions, heldClasses, upcomingClasses, weekday, type ClassSession } from '@/lib/live'
import { getMaterial, type Material, type MaterialLesson } from '@/lib/material'

// What the dashboard shows (plan/16 §12). All reads use the USER-SCOPED client. Every number is counted from real rows;
// anything that cannot be counted is left out rather than made up.

const DAY = 86_400_000
const IST = 5.5 * 3_600_000
/** A date-only column ("2027-01-08") as the start of that day in India. */
export const istDate = (d: string) => new Date(`${d}T00:00:00+05:30`)

export interface BatchInfo {
  id: string; name: string; startDate: string | null; endDate: string | null; schedule: string | null; whatsappGroup: string | null
  /** The weekdays classes run on ("Mon", "Tue"...), and the time they start ("8 pm"). Empty/null when the batch does not say. */
  days: string[]
  at: string | null
}

const DAYS: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' }
/** {"rrule":"FREQ=WEEKLY;BYDAY=TU,TH,SA","time":"19:00"} -> the weekdays and the start time. */
function parseSchedule(schedule: unknown): { days: string[]; at: string | null } {
  const s = (schedule ?? {}) as { rrule?: string; time?: string }
  const days = /BYDAY=([A-Z,]+)/.exec(s.rrule ?? '')?.[1]?.split(',').map((d) => DAYS[d]).filter((d): d is string => Boolean(d)) ?? []
  const at = /^\d{1,2}:\d{2}$/.test(s.time ?? '') ? timeShort(new Date(`2027-01-01T${s.time!.padStart(5, '0')}:00+05:30`)) : null
  return { days, at }
}

/** {"rrule":"FREQ=WEEKLY;BYDAY=TU,TH,SA","time":"19:00"} -> "Tue, Thu and Sat at 7 pm". Null when it says nothing. */
export function scheduleLine(schedule: unknown): string | null {
  const { days: by, at } = parseSchedule(schedule)
  if (!by.length) return null
  const days = by.length === 1 ? by[0] : `${by.slice(0, -1).join(', ')} and ${by.at(-1)}`
  return at ? `${days} at ${at}` : days!
}

const toBatch = (b: { id: string; name: string; start_date: string | null; end_date: string | null; schedule: unknown; settings: unknown }): BatchInfo => {
  const link = ((b.settings ?? {}) as { whatsapp_group_url?: unknown }).whatsapp_group_url
  return {
    id: b.id, name: b.name, startDate: b.start_date, endDate: b.end_date, schedule: scheduleLine(b.schedule), ...parseSchedule(b.schedule),
    whatsappGroup: typeof link === 'string' && /^https:\/\/(chat\.whatsapp\.com|wa\.me)\//.test(link) ? link : null,
  }
}
const BATCH = 'id, name, start_date, end_date, schedule, settings'

export interface Month { id: string; number: string; title: string; done: number; total: number; opensOn: string | null; state: 'done' | 'now' | 'open' | 'locked' }
export interface WeekItem { key: string; state: 'done' | 'half' | 'todo'; title: string; detail: string; href?: string; action?: string; external?: boolean }

export interface Enrolled {
  m: Material
  now: number
  batch: BatchInfo | null
  /** Whole days until the batch starts; 0 once it is running (or when there is no batch). */
  startsIn: number
  months: Month[]
  currentMonth: number
  upcoming: ClassSession[]
  sessions: ClassSession[]
  resume: MaterialLesson | null
  /** Lessons released to the batch by today. Null when the course has no drip schedule to measure against. */
  released: number | null
  stats: Array<{ value: string; label: string }>
  week: { title: string; range: string; items: WeekItem[] }
  tests: { done: number; total: number }
  certificateName: string | null
}

/** Monday 00:00 IST of the week containing `now`. */
function weekStart(now: number) {
  const d = new Date(now + IST)
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return midnight - ((d.getUTCDay() + 6) % 7) * DAY - IST
}

export async function getEnrolled(a: Access, lead: MyEnrollment): Promise<Enrolled | null> {
  const now = nowMs()
  const [m, mine, member] = await Promise.all([
    getMaterial(a, lead.course.slug, now),
    a.db.from('enrollments').select('batch_id').eq('id', lead.id).maybeSingle(),
    a.db.from('tenant_members').select('custom_fields').eq('id', a.memberId).maybeSingle(),
  ])
  if (!m) return null
  const batchId = mine.data?.batch_id ?? null
  const [batchRow, sessions, attendance] = await Promise.all([
    batchId ? a.db.from('batches').select(BATCH).eq('id', batchId).maybeSingle() : Promise.resolve({ data: null }),
    getClassSessions(a, lead.course.id, batchId),
    a.db.from('attendance_records').select('live_session_id').eq('member_id', a.memberId).in('status', ['present', 'late']),
  ])
  const batch = batchRow.data ? toBatch(batchRow.data) : null
  const start = batch?.startDate ? istDate(batch.startDate).getTime() : null
  const startsIn = start && start > now ? Math.ceil((start - now) / DAY) : 0

  const resume = m.course.resume ? m.all.find((l) => l.id === m.course.resume!.id) ?? null : null
  const currentMonth = Math.max(0, m.months.findIndex((mo) => mo.lessons.some((l) => l.id === resume?.id)))
  const months: Month[] = m.months.map((mo, i) => {
    const total = mo.lessons.length
    const locked = total > 0 && mo.lessons.every((l) => l.lock)
    const opens = locked ? mo.lessons.flatMap((l) => (l.lock?.unlocksAt ? [l.lock.unlocksAt] : [])).sort()[0] : undefined
    const opensOn = startsIn && batch?.startDate
      ? dateShort(new Date(start! + Math.min(...mo.lessons.map((l) => l.dripDays ?? 0), 3650) * DAY))
      : opens ? dateShort(opens) : null
    const done = total > 0 && mo.done === total
    return {
      id: mo.id, number: String(i + 1).padStart(2, '0'), title: mo.title, done: mo.done, total, opensOn,
      state: startsIn || locked ? 'locked' : done ? 'done' : i === currentMonth ? 'now' : 'open',
    }
  })

  const elapsed = start && !startsIn ? Math.floor((now - start) / DAY) : null
  const released = elapsed !== null && m.all.some((l) => l.dripDays) ? m.all.filter((l) => (l.dripDays ?? 0) <= elapsed).length : null

  const attended = new Set((attendance.data ?? []).map((r) => r.live_session_id))
  const held = heldClasses(sessions, now)
  const labs = m.all.filter((l) => l.type === 'lab')
  const tests = m.all.filter((l) => l.type === 'quiz' || l.type === 'test')
  const testsDone = tests.filter((l) => l.done).length
  const stats = [
    labs.length ? { value: `${labs.filter((l) => l.done).length}/${labs.length}`, label: 'Labs done' } : null,
    held.length ? { value: `${held.filter((s) => attended.has(s.id)).length}/${held.length}`, label: 'Live classes attended' } : null,
    tests.length ? { value: `${testsDone}/${tests.length}`, label: 'Tests passed' } : null,
    { value: String(m.notes.length), label: 'Notes taken' },
  ].filter((s) => s !== null)

  const cust = (member.data?.custom_fields ?? {}) as { certificate_name?: string | null }
  return {
    m, now, batch, startsIn, months, currentMonth, sessions, upcoming: upcomingClasses(sessions, now), resume, released,
    stats, week: thisWeek(m, sessions, attended, resume, now, lead), tests: { done: testsDone, total: tests.length },
    certificateName: cust.certificate_name || null,
  }
}

function thisWeek(m: Material, sessions: ClassSession[], attended: Set<string>, resume: MaterialLesson | null, now: number, lead: MyEnrollment): Enrolled['week'] {
  const from = weekStart(now), to = from + 7 * DAY
  const href = (id: string) => `/learn/${lead.course.slug}/${id}`
  const open = m.all.filter((l) => !l.lock && !l.done)
  const used = new Set<string>()
  const items: WeekItem[] = []
  const lessonItem = (l: MaterialLesson, action = 'Open'): WeekItem => {
    used.add(l.id)
    const mins = l.durationSeconds ? ` · ${Math.max(1, Math.round(l.durationSeconds / 60))} min` : ''
    return l.pct > 0
      ? { key: l.id, state: 'half', title: `Finish ${l.title}`, detail: `${l.pct}% done`, href: href(l.id), action: 'Resume' }
      : { key: l.id, state: 'todo', title: l.title, detail: `${KIND[l.type] ?? 'Lesson'}${mins}`, href: href(l.id), action }
  }

  const classes = sessions.filter((s) => { const t = new Date(s.startsAt).getTime(); return t >= from && t < to })
  for (const s of classes.slice(0, 3)) {
    const over = s.status === 'completed' || new Date(s.endsAt).getTime() <= now
    const when = `${weekday(s.startsAt)} ${dateShort(s.startsAt)}, ${timeShort(s.startsAt)}`
    const recorded = over && !attended.has(s.id) && s.lessonId ? m.all.find((l) => l.id === s.lessonId) : undefined
    const rec = recorded && !recorded.lock && !recorded.done ? recorded : undefined
    items.push({
      key: s.id, title: s.title, state: attended.has(s.id) || recorded?.done ? 'done' : 'todo',
      detail: attended.has(s.id) ? `Attended ${when}` : over ? `Held ${when}` : `Live class · ${when}`,
      ...(rec ? { href: href(rec.id), action: 'Watch' } : {}),
    })
    if (rec) used.add(rec.id)
  }
  if (resume && !resume.done && resume.pct > 0 && !used.has(resume.id)) items.splice(Math.min(1, items.length), 0, lessonItem(resume))
  const fresh = open.filter((l) => l.isNew && !used.has(l.id)).slice(0, 2)
  for (const l of fresh) items.push(lessonItem(l))
  for (const l of open) { if (items.length >= 4) break; if (!used.has(l.id)) items.push(lessonItem(l)) }

  const behind = lead.lessonsCompleted === 0
  return {
    title: behind ? 'Start with these' : 'This week',
    range: behind ? 'Suggested order' : `${dateShort(new Date(from))} to ${dateShort(new Date(to - DAY))}`,
    items: (behind ? [...open.slice(0, 3).map((l) => ({ ...lessonItem(l), key: `s-${l.id}` })), ...items.filter((i) => !open.slice(0, 3).some((l) => l.id === i.key))] : items).slice(0, 5),
  }
}

export const KIND: Record<string, string> = { video: 'Video', live: 'Class recording', pdf: 'PDF', document: 'Document', image: 'Image', article: 'Reading', quiz: 'Quiz', test: 'Test', download: 'Download', external_link: 'Link', lab: 'Lab', assignment: 'Assignment' }

// ---------------------------------------------------------------- no course yet

export interface ListMatch { email: string; courseSlug: string; courseTitle: string; batchName: string | null; batchStart: string | null; running: boolean }

export async function getJoinState(a: Access) {
  const now = nowMs()
  const tenantId = a.bundle.tenant.id
  const [member, match, orderRow, courses, codeRequired] = await Promise.all([
    a.db.from('tenant_members').select('email, email_verified_at').eq('id', a.memberId).maybeSingle(),
    a.db.rpc('my_list_match', { p_tenant_id: tenantId }),
    a.db.from('orders').select('id, status, order_no, total_minor, currency, placed_at').eq('member_id', a.memberId).in('status', ['awaiting_payment', 'partially_paid']).order('placed_at', { ascending: false }).limit(1).maybeSingle(),
    cachedCourses(tenantId),
    emailCodeRequired(a.db, tenantId),
  ])
  // A project that has not had migration 34 yet answers with an error: then there is simply no match to show.
  if (match.error) console.error('my_list_match failed:', match.error.message)
  const raw = match.error ? null : (match.data as { email: string; course_slug: string; course_title: string; batch_name: string | null; batch_status: string | null; batch_start: string | null } | null)
  const listed: ListMatch | null = raw ? {
    email: raw.email, courseSlug: raw.course_slug, courseTitle: raw.course_title, batchName: raw.batch_name, batchStart: raw.batch_start,
    running: Boolean(raw.batch_start) && istDate(raw.batch_start!).getTime() <= now && raw.batch_status !== 'completed',
  } : null

  const order = orderRow.data
  const { data: proof } = order
    ? await a.db.from('payment_proofs').select('state, file_path, submitted_at').eq('order_id', order.id).order('submitted_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null }

  const slug = listed?.courseSlug ?? courses[0]?.slug
  const course = slug ? await cachedCourse(tenantId, slug) : null

  // The next batch of this course: not started yet, soonest first.
  let next: BatchInfo | null = null
  let runningBatch: string | null = null
  if (course) {
    const [links, batches] = await Promise.all([
      a.db.from('batch_courses').select('batch_id, course_id'),
      a.db.from('batches').select(`${BATCH}, status`).in('status', ['upcoming', 'enrolling', 'ongoing']).order('start_date', { ascending: true }),
    ])
    const rows = (batches.data ?? []).filter((b) => {
      const of = (links.data ?? []).filter((l) => l.batch_id === b.id)
      return !of.length || of.some((l) => l.course_id === course.id) // a batch with no course listed belongs to the only program
    })
    const upcoming = rows.find((b) => b.start_date && istDate(b.start_date).getTime() > now)
    next = upcoming ? toBatch(upcoming) : null
    runningBatch = rows.find((b) => b.start_date && istDate(b.start_date).getTime() <= now && b.status !== 'upcoming')?.name ?? null
  }

  return {
    now, listed, course, courseCount: courses.length, next, runningBatch, order, proof,
    email: member.data?.email ?? null, verified: Boolean(member.data?.email_verified_at), codeRequired,
    daysToNext: next?.startDate ? Math.ceil((istDate(next.startDate).getTime() - now) / DAY) : null,
  }
}
export type JoinState = Awaited<ReturnType<typeof getJoinState>>

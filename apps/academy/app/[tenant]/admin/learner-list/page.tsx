import Link from 'next/link'
import { requireAccess } from '@/lib/dal'
import { dateLong, dateShort } from '@/lib/format'
import { buttonOutline, inputSm } from '@/lib/ui'
import { Card, PageHeader, Tabs } from '../_components/ui'
import { ConfirmButton } from '../_components/confirm'
import { studentPages } from '../_components/sections'
import { StatusChip, type StatusTone } from '../../_components/parts'
import { AddForm } from './add-form'
import { extendEntry, removeFromList } from './actions'

export const metadata = { title: 'Students' }

/*
 * D2 · Learner list (whitelist).
 * 1. One job: record who already has access, so they can join without paying once they confirm their email.
 * 2. One main action: "Add to list" (the only filled button).
 * 3. Reading order: title + one line -> text tabs with counts (not pills) -> the list, name first and status last
 *    (dominant, widest column) -> the add panel beside it (stone, narrower).
 */

const PAGE = 25
const TABS = [['waiting', 'Not joined yet'], ['claimed', 'Joined'], ['expired', 'Expired'], ['all', 'All']] as const
const STATUS: Record<string, [StatusTone, string]> = { waiting: ['wait', 'Not joined yet'], claimed: ['ok', 'Joined'], expired: ['quiet', 'Expired'], removed: ['quiet', 'Removed'] }
const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) ?? null

export default async function LearnerList(props: PageProps<'/[tenant]/admin/learner-list'>) {
  const sp = await props.searchParams
  const tab = TABS.find(([k]) => k === sp.status)?.[0] ?? 'waiting'
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80).replace(/[%,()*\\]/g, '')
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1)
  const a = await requireAccess({ permission: 'enrollment.manage', feature: 'catalog.courses' }, '/admin/learner-list')

  const count = (status?: string) => {
    let c = a.db.from('access_whitelist').select('id', { count: 'exact', head: true })
    c = status ? c.eq('status', status) : c.neq('status', 'removed')
    return c
  }
  let list = a.db.from('access_whitelist')
    .select('id, email_norm, full_name, status, expires_at, claimed_at, batches(name), courses(title)', { count: 'exact' })
    .order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  list = tab === 'all' ? list.neq('status', 'removed') : list.eq('status', tab)
  if (q) list = list.or(`email_norm.ilike.%${q}%,full_name.ilike.%${q}%`)

  const [rows, nWaiting, nClaimed, nExpired, nAll, courses, batches] = await Promise.all([
    list, count('waiting'), count('claimed'), count('expired'), count(),
    a.db.from('courses').select('id, title').is('deleted_at', null).order('title'),
    a.db.from('batches').select('id, name').in('status', ['upcoming', 'enrolling', 'ongoing']).order('start_date', { ascending: false }).limit(50),
  ])
  const counts = { waiting: nWaiting.count ?? 0, claimed: nClaimed.count ?? 0, expired: nExpired.count ?? 0, all: nAll.count ?? 0 }
  const total = rows.count ?? 0
  const href = (over: Record<string, string | number | null>) => {
    const p = new URLSearchParams()
    const base: Record<string, string | number | null> = { status: tab === 'waiting' ? null : tab, q: q || null, page: null, ...over }
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== '') p.set(k, String(v))
    const s = p.toString()
    return `/admin/learner-list${s ? `?${s}` : ''}`
  }

  return (
    <>
      <PageHeader title="Students" lead="Add the emails of people who already paid you. When they sign up, they can join their course without paying again." />
      <Tabs label="Students" current="/admin/learner-list" items={studentPages(a)} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="ll-h" className="min-w-0 rounded-[20px] bg-white p-5 ring-1 ring-border sm:p-6">
          <h2 id="ll-h" className="sr-only">People on the list</h2>
          <nav aria-label="Filter the list" className="flex flex-wrap gap-x-6 border-b border-border">
            {TABS.map(([k, label]) => (
              <Link key={k} href={href({ status: k === 'waiting' ? null : k })} aria-current={tab === k ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 border-b-[3px] -mb-px t-label ${tab === k ? 'border-fg !text-fg font-bold' : 'border-transparent hover:!text-fg'}`}>
                {label} <span className="tnum font-normal text-mute">{counts[k]}</span>
              </Link>
            ))}
          </nav>

          <form action="/admin/learner-list" className="flex flex-wrap items-center gap-3 py-4">
            {tab !== 'waiting' && <input type="hidden" name="status" value={tab} />}
            <label htmlFor="ll-q" className="sr-only">Search by email or name</label>
            <input id="ll-q" name="q" defaultValue={q} placeholder="Search by email or name" className={`${inputSm} max-w-sm`} />
            <button className={buttonOutline}>Search</button>
          </form>

          {rows.data?.length ? (
            <ul className="border-t-2 border-fg">
              {rows.data.map((r) => {
                const [tone, word] = STATUS[r.status] ?? (['quiet', r.status] as [StatusTone, string])
                const batch = one(r.batches)
                return (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 border-b border-border py-3.5">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="t-card !text-[17px] break-words">{r.full_name || r.email_norm}</p>
                      {r.full_name && <p className="t-small break-all">{r.email_norm}</p>}
                      <p className="t-small tnum">{r.expires_at ? `Access until ${dateLong(r.expires_at)}` : 'No end date'}{batch?.name ? ` · ${batch.name}` : ''}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusChip tone={tone}>{word}{r.status === 'claimed' && r.claimed_at ? ` ${dateShort(r.claimed_at)}` : ''}</StatusChip>
                      {r.status === 'waiting' && (
                        <ConfirmButton action={removeFromList.bind(null, r.id)} label="Remove" name={`Remove ${r.email_norm}`} yes="Yes, remove" question={`Take ${r.email_norm} off the list?`} />
                      )}
                      {r.status === 'expired' && (
                        <form action={extendEntry.bind(null, r.id)} className="flex flex-wrap items-center justify-end gap-2">
                          <label className="sr-only" htmlFor={`x-${r.id}`}>New end date for {r.email_norm}</label>
                          <input id={`x-${r.id}`} name="until" type="date" required className={`${inputSm} !w-40`} />
                          <button className="inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4">Extend</button>
                        </form>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="t-body border-t-2 border-fg py-6">{q ? `No one matches “${q}”.` : tab === 'waiting' ? 'No one is waiting. Add emails with the form.' : 'Nothing here yet.'}</p>
          )}

          {total > PAGE && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-4 pt-4">
              <p className="t-small tnum">Showing {(page - 1) * PAGE + 1} to {Math.min(page * PAGE, total)} of {total}</p>
              <div className="flex gap-3">
                {page > 1 && <Link href={href({ page: page - 1 })} className={buttonOutline}>Previous</Link>}
                {page * PAGE < total && <Link href={href({ page: page + 1 })} className={buttonOutline}>Next</Link>}
              </div>
            </nav>
          )}
        </section>

        <section aria-labelledby="add-h" className="xl:sticky xl:top-8">
          <Card>
            <h2 id="add-h" className="t-section mb-4">Add emails</h2>
            {courses.data?.length
              ? <AddForm courses={courses.data.map((c) => ({ id: c.id, label: c.title }))} batches={(batches.data ?? []).map((b) => ({ id: b.id, label: b.name }))} />
              : <p className="t-body">Create a course first, then add emails to it.</p>}
          </Card>
        </section>
      </div>
    </>
  )
}

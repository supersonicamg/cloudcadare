import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { isEnabled } from '@educore/features'
import { notFound } from 'next/navigation'
import { requireMember } from '@/lib/dal'
import { clock } from '@/lib/clock'
import { dateShort } from '@/lib/format'
import { getNoteGroups, KINDS, noteHref } from '@/lib/my-notes'
import type { NoteKind } from '@/lib/notes'
import { getShell } from '@/lib/shell'
import { buttonOutline, inputSm } from '@/lib/ui'
import { Panel } from '../../_components/parts'

export const metadata: Metadata = { title: 'My notes' }

/*
 * B7 · My notes.
 * 1. One job: find a note again. No filled button; "Download as PDF" is an outline button.
 * 2. Reading order: title + counts -> filter by kind and search -> notes grouped by lesson (the lesson with the newest note first).
 * 3. Every note is a link that opens the lesson at that minute (?t=) or page (?page=). Notes are private: only the learner reads them.
 */

const ICON = { note: 'note', bookmark: 'bookmark', highlight: 'highlight' } as const

export default async function MyNotes({ searchParams }: PageProps<'/[tenant]/learn/notes'>) {
  const sp = await searchParams
  const a = await requireMember('/learn/notes')
  if (!isEnabled(a.bundle.features, 'learning.notes')) notFound()
  const kind = (KINDS.find((k) => k.key === sp.kind)?.key ?? 'all') as NoteKind | 'all'
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80)
  const [{ theme, brand, nav, account, site }, r] = await Promise.all([getShell(), getNoteGroups(a, kind, q)])
  const href = (k: string) => `/learn/notes${k === 'all' && !q ? '' : `?${new URLSearchParams({ ...(k !== 'all' ? { kind: k } : {}), ...(q ? { q } : {}) })}`}`

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <main>
        <section aria-labelledby="nt-h" className="mx-auto grid max-w-[1280px] gap-6 px-[clamp(16px,5vw,72px)] pb-6 pt-8 md:pt-12">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="grid gap-3">
              <h1 id="nt-h" className="t-title">My notes</h1>
              <p className="t-lead">{r.counts.all ? `${r.counts.all} ${r.counts.all === 1 ? 'note' : 'notes'} and bookmarks from ${r.lessons} ${r.lessons === 1 ? 'lesson' : 'lessons'}. Only you can see them.` : 'Notes you take in a lesson are kept here. Only you can see them.'}</p>
            </div>
            {r.counts.all > 0 && <Link href="/learn/notes/print" target="_blank" className={buttonOutline}><Icon name="print" className="h-4 w-4" />Download as PDF</Link>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav aria-label="Filter by kind" className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Link key={k.key} href={href(k.key)} aria-current={kind === k.key ? 'true' : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 t-label ${kind === k.key ? 'border-fg bg-fg !text-white' : 'border-border hover:border-fg'}`}>
                  {k.label}<span className="tnum opacity-80">{r.counts[k.key]}</span>
                </Link>
              ))}
            </nav>
            <form action="/learn/notes" role="search" className="flex items-center gap-2">
              {kind !== 'all' && <input type="hidden" name="kind" value={kind} />}
              <label htmlFor="nq" className="sr-only">Search my notes</label>
              <input id="nq" name="q" type="search" defaultValue={q} placeholder="Search my notes" className={`${inputSm} w-[min(100%,280px)]`} />
              <button className={buttonOutline}><Icon name="search" className="h-4 w-4" />Search</button>
            </form>
          </div>
        </section>

        <section aria-label="Notes by lesson" className="px-[clamp(10px,1.6vw,24px)] pb-16">
          <Panel className="mx-auto max-w-[1280px]">
            {r.groups.length === 0 ? (
              <p className="t-body">{r.counts.all === 0 ? 'No notes yet. Open a lesson and press N while it plays.' : 'No note matches. '}{r.counts.all > 0 && <Link href="/learn/notes" className="font-semibold text-primary underline underline-offset-4">Clear the filters</Link>}</p>
            ) : (
              <div className="grid gap-4">
                {r.groups.map((g) => (
                  <section key={g.lessonId} aria-label={g.title} className="rounded-[20px] bg-white p-5">
                    <h2 className="t-card flex flex-wrap items-baseline justify-between gap-x-4">
                      {g.href ? <Link href={g.href} className="hover:underline">{g.title}</Link> : g.title}
                      <span className="t-small tnum">{g.notes.length} {g.notes.length === 1 ? 'item' : 'items'}</span>
                    </h2>
                    <ul className="mt-3 border-t-2 border-fg">
                      {g.notes.map((n) => {
                        const place = n.positionSeconds !== null ? clock(n.positionSeconds) : n.pageNo !== null ? `Page ${n.pageNo}` : 'Lesson'
                        const inner = (
                          <>
                            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#E4EFEB] px-2.5 t-label tnum !font-bold !text-deep"><Icon name={ICON[n.kind]} className="h-4 w-4" />{place}</span>
                            <span className="t-body min-w-0 break-words whitespace-pre-line !text-fg">{n.kind === 'highlight' && n.body ? <mark className="bg-accent/70 px-0.5">{n.body}</mark> : n.body || <span className="text-mute">Bookmark</span>}</span>
                            <span className="t-small whitespace-nowrap">{dateShort(n.createdAt)}</span>
                          </>
                        )
                        const cls = 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 border-b border-border py-3 max-sm:grid-cols-[auto_minmax(0,1fr)]'
                        return g.href
                          ? <li key={n.id}><Link href={noteHref(g.href, n)} className={`${cls} rounded-lg hover:bg-muted/60`}>{inner}</Link></li>
                          : <li key={n.id} className={cls}>{inner}</li>
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Panel>
        </section>
      </main>
    </theme.SiteLayout>
  )
}

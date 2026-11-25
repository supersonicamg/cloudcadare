import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { clock } from '@/lib/clock'
import { dateShort } from '@/lib/format'
import { getNoteGroups, KINDS, noteHref } from '@/lib/my-notes'
import type { NoteKind } from '@/lib/notes'
import { getShell } from '@/lib/shell'
import { buttonOutline } from '@/lib/ui'
import { LearnerShell } from '../../_components/learner-shell'

export const metadata: Metadata = { title: 'Notes' }

/*
 * Notes. One job: find a note again. No filled button; "Download as PDF" is an outline button.
 * Reading order: title + count -> search + filter by kind -> notes grouped by lesson (newest first).
 * Each note is a link that reopens the lesson at that minute (?t=) or page (?page=). Notes are private.
 */
const ICON = { note: 'note', bookmark: 'bookmark', highlight: 'highlight' } as const

export default async function Notes({ searchParams }: PageProps<'/[tenant]/learn/notes'>) {
  const sp = await searchParams
  const a = await requireMember('/learn/notes')
  if (!isEnabled(a.bundle.features, 'learning.notes')) notFound()
  const kind = (KINDS.find((k) => k.key === sp.kind)?.key ?? 'all') as NoteKind | 'all'
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80)
  const [shell, r] = await Promise.all([getShell(), getNoteGroups(a, kind, q)])
  const href = (k: string) => `/learn/notes${k === 'all' && !q ? '' : `?${new URLSearchParams({ ...(k !== 'all' ? { kind: k } : {}), ...(q ? { q } : {}) })}`}`
  const filtering = kind !== 'all' || Boolean(q)

  return (
    <LearnerShell a={a} shell={shell} active="notes">
      <header className="lx-head">
        <div>
          <h1 className="lx-h1">Notes</h1>
          <p className="lx-lede">{r.counts.all ? `${r.counts.all} ${r.counts.all === 1 ? 'note' : 'notes'} from ${r.lessons} ${r.lessons === 1 ? 'lesson' : 'lessons'}. Only you can see them.` : 'Notes, bookmarks and highlights you make in a lesson are kept here. Only you can see them.'}</p>
        </div>
        {r.counts.all > 0 && <Link href="/learn/notes/print" target="_blank" className={`${buttonOutline} max-[720px]:w-full`}><Icon name="print" className="lx-i" />Download as PDF</Link>}
      </header>

      {r.counts.all > 0 && (
        <div className="grid gap-4">
          <form action="/learn/notes" role="search" className="lx-search">
            {kind !== 'all' && <input type="hidden" name="kind" value={kind} />}
            <label>
              <span className="sr-only">Search my notes</span>
              <Icon name="search" />
              <input name="q" type="search" defaultValue={q} placeholder="Search your notes" enterKeyHint="search" />
            </label>
            <button type="submit">Search</button>
          </form>
          <nav aria-label="Filter by kind" className="lx-chips">
            {KINDS.map((k) => (
              <Link key={k.key} href={href(k.key)} aria-current={kind === k.key ? 'true' : undefined}>{k.label}<em>{r.counts[k.key]}</em></Link>
            ))}
          </nav>
        </div>
      )}

      {r.groups.length === 0 ? (
        r.counts.all === 0 ? (
          <section className="lx-empty">
            <b>No notes yet</b>
            <p>Open a lesson and press <strong>N</strong> while it plays, or use the notes tab beside the video. Your notes, bookmarks and highlights will show up here, and each one takes you back to the exact minute.</p>
          </section>
        ) : (
          <section className="lx-empty"><b>No note matches</b>{filtering && <Link href="/learn/notes" className="lx-link">Clear the search</Link>}</section>
        )
      ) : (
        <div className="grid gap-5">
          {r.groups.map((g) => (
            <section key={g.lessonId} aria-label={g.title} className="lx-card lx-ngroup">
              <h2>
                {g.href ? <Link href={g.href}>{g.title}</Link> : <span>{g.title}</span>}
                <span className="c">{g.notes.length} {g.notes.length === 1 ? 'item' : 'items'}</span>
              </h2>
              <ul>
                {g.notes.map((n) => {
                  const place = n.positionSeconds !== null ? clock(n.positionSeconds) : n.pageNo !== null ? `Page ${n.pageNo}` : 'Lesson'
                  const inner = (
                    <>
                      <span className="lx-where"><Icon name={ICON[n.kind]} />{place}</span>
                      <span className={`lx-ntext${n.body ? '' : ' quiet'}`}>{n.kind === 'highlight' && n.body ? <mark>{n.body}</mark> : n.body || 'Bookmark'}</span>
                      <span className="lx-when">{dateShort(n.createdAt)}</span>
                    </>
                  )
                  return (
                    <li key={n.id}>
                      {g.href ? <Link href={noteHref(g.href, n)} className="lx-note-row">{inner}</Link> : <div className="lx-note-row">{inner}</div>}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </LearnerShell>
  )
}

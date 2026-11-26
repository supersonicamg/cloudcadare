import Link from 'next/link'
import { requireMember } from '@/lib/dal'
import { getMyEnrollments } from '@/lib/learn'
import { getShell } from '@/lib/shell'
import { initialsOf } from '../_components/v11'
import type { ReminderKey } from './actions'
import { ProfileForm, ReminderSwitch } from './forms'
import { BrandMark } from './ui'

export const metadata = { title: 'Profile' }

/*
 * Profile ("keep my details right"): name, number, city, name on the certificate.
 * One filled button: Save changes. The reminder switches save on their own and carry no button.
 */

const REMINDERS: Array<{ id: ReminderKey; title: string; detail: string; fallback: boolean; channel: 'whatsapp' | 'email' }> = [
  { id: 'live_class.reminder:whatsapp', title: 'Class reminders on WhatsApp', detail: '30 minutes before each class', fallback: true, channel: 'whatsapp' },
  { id: 'live_class.reminder:email', title: 'Class reminders by email', detail: 'The evening before, and 30 minutes before', fallback: true, channel: 'email' },
  { id: 'material.new:email', title: 'New material by email', detail: 'When a trainer adds a recording, PDF or lab', fallback: false, channel: 'email' },
]

const since = (iso: string) => new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

export default async function ProfilePage() {
  const a = await requireMember('/account')
  const [{ brand }, member, prefs, certs, mine] = await Promise.all([
    getShell(),
    a.db.from('tenant_members').select('display_name, phone, email, custom_fields, joined_at').eq('id', a.memberId).single(),
    a.db.from('notification_preferences').select('event_key, channel, enabled').eq('member_id', a.memberId),
    a.db.from('certificates').select('id', { count: 'exact', head: true }).eq('member_id', a.memberId),
    getMyEnrollments(a),
  ])
  const custom = (member.data?.custom_fields ?? {}) as { city?: string; certificate_name?: string }
  const stored = new Map((prefs.data ?? []).map((p) => [`${p.event_key}:${p.channel}`, p.enabled]))
  const name = member.data?.display_name ?? a.memberName
  const email = member.data?.email ?? ''
  const program = (mine.find((e) => e.status === 'active') ?? mine[0])?.course.title ?? null

  return (
    <>
      <div className="pg-h"><div><h1 className="t-title">Profile</h1><p className="t-lead">How {brand.name} and your trainers see you.</p></div></div>
      <div className="mehead">
        <span className="av av-l" aria-hidden="true">{initialsOf(name)}</span>
        <div>
          <p className="t-h3">{name}</p>
          <p className="t-small">{[email, member.data?.joined_at ? `learner since ${since(member.data.joined_at)}` : null].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      <ProfileForm
        name={name}
        whatsapp={member.data?.phone ?? ''}
        email={email}
        city={custom.city ?? ''}
        certificateName={custom.certificate_name ?? name}
        certificateLocked={(certs.count ?? 0) > 0}
        mark={<BrandMark brand={brand} />}
        program={program}
        hintLink={<>To change it, see <Link href="/account/security">Password and devices</Link>.</>}
      />

      <section className="blk" aria-labelledby="rm-h">
        <div className="blk-h"><h2 className="t-h3" id="rm-h">Reminders</h2><p className="t-small">Payment and security messages always come through.</p></div>
        <ul className="rows">
          {REMINDERS.map((r) => <ReminderSwitch key={r.id} id={r.id} title={r.title} detail={r.detail} on={stored.get(r.id) ?? r.fallback} channel={r.channel} />)}
        </ul>
      </section>
    </>
  )
}

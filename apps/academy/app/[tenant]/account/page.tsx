import { requireMember } from '@/lib/dal'
import { h1s, h2s, lead } from '@/lib/ui'
import { Panel } from '../_components/parts'
import type { ReminderKey } from './actions'
import { ProfileForm, ReminderSwitch } from './forms'

export const metadata = { title: 'Profile' }

/*
 * C2 · Profile.
 * 1. One job: keep my details right (name, number, city, name on the certificate).
 * 2. One main action: "Save changes". Reminder switches save on their own and carry no button.
 * 3. Reading order: title -> one line -> the details panel (dominant: stone, most space) -> reminders as a
 *    quiet ruled list underneath (no card, smaller type weight) -> done.
 */

const REMINDERS: Array<{ id: ReminderKey; title: string; detail: string; fallback: boolean }> = [
  { id: 'live_class.reminder:whatsapp', title: 'Live class reminders on WhatsApp', detail: '30 minutes before each class', fallback: true },
  { id: 'live_class.reminder:email', title: 'Live class reminders by email', detail: 'The evening before and 30 minutes before', fallback: true },
  { id: 'material.new:email', title: 'New material by email', detail: 'When a trainer adds a recording, PDF or lab', fallback: false },
]

export default async function ProfilePage() {
  const a = await requireMember('/account')
  const [member, prefs, certs] = await Promise.all([
    a.db.from('tenant_members').select('display_name, phone, email, custom_fields').eq('id', a.memberId).single(),
    a.db.from('notification_preferences').select('event_key, channel, enabled').eq('member_id', a.memberId),
    a.db.from('certificates').select('id', { count: 'exact', head: true }).eq('member_id', a.memberId),
  ])
  const custom = (member.data?.custom_fields ?? {}) as { city?: string; certificate_name?: string }
  const stored = new Map((prefs.data ?? []).map((p) => [`${p.event_key}:${p.channel}`, p.enabled]))
  const name = member.data?.display_name ?? a.memberName

  return (
    <div className="grid gap-12">
      <section aria-labelledby="pf-h" className="grid gap-6">
        <div className="grid gap-3">
          <h1 id="pf-h" className={h1s}>Profile</h1>
          <p className={lead}>This is how CloudCadre and your trainers see you.</p>
        </div>
        <Panel>
          <ProfileForm
            name={name}
            whatsapp={member.data?.phone ?? ''}
            email={member.data?.email ?? ''}
            city={custom.city ?? ''}
            certificateName={custom.certificate_name ?? name}
            certificateLocked={(certs.count ?? 0) > 0}
          />
        </Panel>
      </section>

      <section aria-labelledby="rm-h" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="rm-h" className={h2s}>Reminders</h2>
          <p className="t-body">Payment and security messages always come through.</p>
        </div>
        <ul className="border-t-2 border-fg">
          {REMINDERS.map((r) => <ReminderSwitch key={r.id} id={r.id} title={r.title} detail={r.detail} on={stored.get(r.id) ?? r.fallback} />)}
        </ul>
      </section>
    </div>
  )
}

'use client'

import { useActionState } from 'react'
import { button, input } from '@/lib/ui'
import { redeem, type RedeemState } from './actions'

export function RedeemForm({ baseDomain }: { baseDomain: string }) {
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeem, {})
  return (
    <form action={action} className="max-w-md space-y-5">
      <div>
        <label htmlFor="key" className="block text-sm font-medium">License key</label>
        <input id="key" name="key" placeholder="EDU-XXXX-XXXX-XXXX-XXXX" autoComplete="off" required className={input} />
      </div>
      <div>
        <label htmlFor="academyName" className="block text-sm font-medium">Academy name</label>
        <input id="academyName" name="academyName" required className={input} />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium">Address</label>
        <div className="flex items-center gap-2">
          <input id="slug" name="slug" required className={input} aria-describedby="slug-hint" />
          <span className="whitespace-nowrap text-sm text-fg/70">.{baseDomain}</span>
        </div>
        <p id="slug-hint" className="mt-1 text-sm text-fg/60">You can add your own domain later.</p>
      </div>
      <div>
        <label htmlFor="ownerName" className="block text-sm font-medium">Your name</label>
        <input id="ownerName" name="ownerName" autoComplete="name" required className={input} />
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button className={button} disabled={pending}>{pending ? 'Creating your academy…' : 'Create academy'}</button>
    </form>
  )
}

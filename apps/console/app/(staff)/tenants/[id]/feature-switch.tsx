'use client'

import { useActionState } from 'react'
import { clearOverride, setFeature, type ActionState } from './actions'

/** One feature row's switch. A real form, so it also works before the page has hydrated. */
export function FeatureSwitch(props: {
  tenantId: string; featureKey: string; name: string; on: boolean; editable: boolean; overridden: boolean; note: string | null
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setFeature, {})
  const [clearState, clearAction, clearing] = useActionState<ActionState, FormData>(clearOverride, {})
  const error = state.error ?? clearState.error
  const busy = pending || clearing
  return (
    <div className="flex flex-col items-end gap-1.5">
    <div className="flex items-center justify-end gap-4">
      {props.overridden && props.editable && (
        <form action={clearAction}>
          <input type="hidden" name="tenantId" value={props.tenantId} />
          <input type="hidden" name="featureKey" value={props.featureKey} />
          <button disabled={busy} className="text-sm font-semibold text-primary underline underline-offset-2 disabled:opacity-60">Back to plan</button>
        </form>
      )}
      <form action={action}>
        <input type="hidden" name="tenantId" value={props.tenantId} />
        <input type="hidden" name="featureKey" value={props.featureKey} />
        <input type="hidden" name="enabled" value={String(!props.on)} />
        <button
          role="switch"
          aria-checked={props.on}
          aria-label={`${props.name}: ${props.on ? 'on' : 'off'}`}
          title={props.note ?? undefined}
          disabled={!props.editable || busy}
          className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${props.on ? 'bg-primary' : 'bg-field/50'} ${busy ? 'opacity-60' : ''} ${!props.editable ? 'opacity-50' : ''}`}
        >
          <span className={`absolute top-[3px] size-5 rounded-full bg-white transition-all ${props.on ? 'left-[21px]' : 'left-[3px]'}`} />
        </button>
      </form>
    </div>
    {error && <p role="alert" className="max-w-xs text-right text-sm text-danger-ink">{error}</p>}
    </div>
  )
}

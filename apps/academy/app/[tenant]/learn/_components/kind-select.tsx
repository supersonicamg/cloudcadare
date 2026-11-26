'use client'

/**
 * "Show only" on a phone: a native select that applies as soon as it changes. It is a real GET form, so without script
 * the Show button does the same. `hidden` carries the other filters (the search words) through the change.
 */
export function KindSelect({ id, action, name, value, options, hidden, label }: {
  id: string
  action: string
  name: string
  value: string
  options: Array<{ value: string; label: string }>
  hidden?: Record<string, string>
  label: string
}) {
  return (
    <form action={action} className="kind-form">
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="sr" htmlFor={id}>{label}</label>
      <select className="select" id={id} name={name} defaultValue={value} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <noscript><button type="submit" className="btn btn-line btn-sm">Show</button></noscript>
    </form>
  )
}

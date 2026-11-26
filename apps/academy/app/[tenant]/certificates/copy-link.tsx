'use client'

import { useState } from 'react'

/** Copies the public check link. Says "Copied" for a moment; if the browser refuses, it says so. */
export function CopyLink({ url }: { url: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <>
      <button type="button" className="link link-s" onClick={() => {
        navigator.clipboard.writeText(url).then(() => setMsg('Copied'), () => setMsg('Could not copy. Select the code instead.'))
        setTimeout(() => setMsg(null), 2500)
      }}>Copy check link</button>
      <span role="status">{msg}</span>
    </>
  )
}

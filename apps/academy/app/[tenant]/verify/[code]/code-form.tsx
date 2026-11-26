'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Re-check with another code. Malformed codes get the same neutral answer as unknown ones. */
export function CodeForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const clean = code.replace(/[^A-Za-z0-9]/g, '')
  return (
    <form className="vform" onSubmit={(e) => { e.preventDefault(); if (clean.length === 12) router.push(`/verify/${clean}`) }}>
      <div className="fld">
        <label htmlFor="code">Check another code</label>
        <input id="code" className="in" value={code} onChange={(e) => setCode(e.target.value)} maxLength={14} autoComplete="off" spellCheck={false} placeholder="12 letters and numbers" />
      </div>
      <button type="submit" className="btn btn-line" disabled={clean.length !== 12}>Check</button>
    </form>
  )
}

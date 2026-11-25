'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { input, label } from '@/lib/ui'

/** Re-check with another code. Malformed codes get the same neutral answer as unknown ones. */
export function CodeForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const clean = code.replace(/[^A-Za-z0-9]/g, '')
  return (
    <form className="mt-5" onSubmit={(e) => { e.preventDefault(); if (clean.length === 12) router.push(`/verify/${clean}`) }}>
      <label htmlFor="code" className={label}>Certificate code</label>
      <div className="mt-2 flex gap-2.5">
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={14} autoComplete="off" spellCheck={false}
          className={`${input} h-14 flex-1 font-mono text-[17px] uppercase tracking-wider`} />
        <button type="submit" disabled={clean.length !== 12} className="inline-flex h-14 items-center justify-center rounded-xl bg-primary px-7 text-[17px] font-semibold text-primary-fg hover:bg-deep disabled:cursor-not-allowed disabled:bg-[#D9D6CC] disabled:text-[#6A726F]">Check</button>
      </div>
    </form>
  )
}

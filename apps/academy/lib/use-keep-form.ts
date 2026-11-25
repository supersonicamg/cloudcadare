'use client'

import { startTransition, useActionState, type FormEvent } from 'react'

export type KeepState = { error?: string; saved?: boolean; message?: string }

/**
 * Like useActionState for a <form>, but the form is NOT reset after the action runs. React resets uncontrolled
 * fields after every form action, which would wipe a long lesson or course description when the server rejects
 * one field. Use `<form onSubmit={onSubmit}>` instead of `<form action={…}>`.
 */
export function useKeepForm(action: (state: KeepState, form: FormData) => Promise<KeepState>) {
  const [state, run, pending] = useActionState<KeepState, FormData>(action, {})
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    startTransition(() => run(data))
  }
  return [state, onSubmit, pending] as const
}

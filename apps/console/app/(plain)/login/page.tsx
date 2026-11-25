import { safeNext } from '@educore/core/accounts'
import { AuthForm } from './auth-form'

export const metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next, error } = await searchParams
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 mb-8 text-fg/70">Use your email and password.</p>
      {error === 'not_staff' && (
        <p role="alert" className="mb-6 max-w-sm text-sm text-danger">
          This account is not a member of a distributor. Ask an owner to add you.
        </p>
      )}
      <AuthForm mode="login" next={safeNext(next)} />
    </>
  )
}

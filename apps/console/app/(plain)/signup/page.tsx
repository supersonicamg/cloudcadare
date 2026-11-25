import { safeNext } from '@educore/core/accounts'
import { AuthForm } from '../login/auth-form'

export const metadata = { title: 'Create account' }

export default async function SignUpPage({ searchParams }: PageProps<'/signup'>) {
  const { next } = await searchParams
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 mb-8 text-fg/70">Use it to set up an academy, or to sign in to the console once an owner adds you.</p>
      <AuthForm mode="signup" next={safeNext(next)} />
    </>
  )
}

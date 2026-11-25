import { Suspense } from 'react'
import { getShell } from '@/lib/shell'
import { entryContext } from './context'
import { LoginForm } from './login-form'

export const metadata = { title: 'Log in' }

async function Form({ searchParams, tenantId }: { searchParams: PageProps<'/[tenant]/login'>['searchParams']; tenantId: string }) {
  const { next } = await searchParams
  return <LoginForm {...await entryContext(next, tenantId)} />
}

export default async function LoginPage(props: PageProps<'/[tenant]/login'>) {
  const { theme, brand, site, bundle } = await getShell()
  return (
    <theme.AuthLayout brand={brand} site={site}>
      {/* searchParams is request-time data: it streams inside Suspense under Cache Components. */}
      <Suspense fallback={<div className="h-40" aria-busy />}>
        <Form searchParams={props.searchParams} tenantId={bundle.tenant.id} />
      </Suspense>
    </theme.AuthLayout>
  )
}

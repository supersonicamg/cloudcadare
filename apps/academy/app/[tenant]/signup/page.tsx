import { Suspense } from 'react'
import { getShell } from '@/lib/shell'
import { entryContext } from '../login/context'
import { SignUpForm } from './signup-form'

export const metadata = { title: 'Create account' }

async function Form({ searchParams, tenantId }: { searchParams: PageProps<'/[tenant]/signup'>['searchParams']; tenantId: string }) {
  const { next } = await searchParams
  return <SignUpForm {...await entryContext(next, tenantId)} />
}

export default async function SignUpPage(props: PageProps<'/[tenant]/signup'>) {
  const { theme, brand, site, bundle } = await getShell()
  return (
    <theme.AuthLayout brand={brand} site={site}>
      <Suspense fallback={<div className="h-40" aria-busy />}>
        <Form searchParams={props.searchParams} tenantId={bundle.tenant.id} />
      </Suspense>
    </theme.AuthLayout>
  )
}

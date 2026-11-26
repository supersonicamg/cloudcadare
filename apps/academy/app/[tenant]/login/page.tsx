import { Suspense } from 'react'
import Link from 'next/link'
import type { BrandInfo } from '@educore/ui/theme'
import { getShell } from '@/lib/shell'
import { waHref } from '../_components/v11-bars'
import { AuthFrame, AuthTop } from './auth-frame'
import { entryContext, withNext } from './context'
import { LoginForm } from './login-form'

export const metadata = { title: 'Log in' }

async function Content({ searchParams, tenantId, brand }: { searchParams: PageProps<'/[tenant]/login'>['searchParams']; tenantId: string; brand: BrandInfo }) {
  const { next } = await searchParams
  const entry = await entryContext(next, tenantId)
  return (
    <>
      <AuthTop brand={brand}>New here? <Link className="link link-s" href={withNext('/signup', entry.next)}>Create an account</Link></AuthTop>
      <LoginForm {...entry} forgotHref={waHref(brand, 'Hi, I forgot my password.')} />
    </>
  )
}

export default async function LoginPage(props: PageProps<'/[tenant]/login'>) {
  const { brand, home, bundle } = await getShell()
  return (
    <AuthFrame brand={brand} learner={home?.hero.learner}>
      {/* searchParams is request-time data: it streams inside Suspense under Cache Components. */}
      <Suspense fallback={<><AuthTop brand={brand} /><div className="auth-box" aria-busy /></>}>
        <Content searchParams={props.searchParams} tenantId={bundle.tenant.id} brand={brand} />
      </Suspense>
    </AuthFrame>
  )
}

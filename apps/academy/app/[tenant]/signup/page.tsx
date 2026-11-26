import { Suspense } from 'react'
import Link from 'next/link'
import type { BrandInfo } from '@educore/ui/theme'
import { getShell } from '@/lib/shell'
import { AuthFrame, AuthTop } from '../login/auth-frame'
import { entryContext, withNext } from '../login/context'
import { SignUpForm } from './signup-form'

export const metadata = { title: 'Create account' }

async function Content({ searchParams, tenantId, brand, facts }: {
  searchParams: PageProps<'/[tenant]/signup'>['searchParams']; tenantId: string; brand: BrandInfo; facts?: Array<{ label: string; value: string; note?: string }>
}) {
  const { next } = await searchParams
  const entry = await entryContext(next, tenantId)
  return (
    <>
      <AuthTop brand={brand}><span className="ask">Have an account? </span><Link className="link link-s" href={withNext('/login', entry.next)}>Log in</Link></AuthTop>
      <SignUpForm {...entry} facts={facts} />
    </>
  )
}

export default async function SignUpPage(props: PageProps<'/[tenant]/signup'>) {
  const { brand, home, bundle } = await getShell()
  return (
    <AuthFrame brand={brand} photo={home?.authPhoto}>
      <Suspense fallback={<><AuthTop brand={brand} /><div className="auth-box" aria-busy /></>}>
        <Content searchParams={props.searchParams} tenantId={bundle.tenant.id} brand={brand} facts={home?.hero.facts} />
      </Suspense>
    </AuthFrame>
  )
}

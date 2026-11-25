export const metadata = { title: 'Academy created' }

export default async function Done({ searchParams }: PageProps<'/start/done'>) {
  const { slug } = await searchParams
  const base = process.env.BASE_DOMAIN ?? 'localhost'
  const s = typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug) ? slug : null
  const port = base === 'localhost' ? ':3000' : ''
  const scheme = base === 'localhost' ? 'http' : 'https'
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Your academy is ready</h1>
      {s ? (
        <p className="mt-4 text-lg">
          Open <a className="text-primary underline" href={`${scheme}://${s}.${base}${port}`}>{s}.{base}</a> and sign in with
          the same email and password. You are the owner.
        </p>
      ) : <p className="mt-4 text-fg/70">Open your academy address and sign in with the same email and password.</p>}
    </>
  )
}

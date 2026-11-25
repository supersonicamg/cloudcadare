import Link from 'next/link'

// Sign-in and the "redeem a key" page: for people who are not (yet) working inside the console.
export default function PlainLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-5">
          <Link href="/" className="font-semibold">EduCore Console</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>
    </>
  )
}

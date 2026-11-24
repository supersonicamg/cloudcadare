import '../globals.css'

export const metadata = { title: 'EduCore' }

/** Pages that are not part of any academy (unknown address, suspended academy). Neutral on purpose: it says nothing about whose site this was. */
export default function PlatformLayout({ children }: LayoutProps<'/platform'>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
          <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true" className="mb-6 text-mute">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 7.5v5.5M12 16.2v.1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {children}
        </main>
      </body>
    </html>
  )
}

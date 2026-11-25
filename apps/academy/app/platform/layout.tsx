import '../globals.css'

export const metadata = { title: 'EduCore' }

export default function PlatformLayout({ children }: LayoutProps<'/platform'>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">{children}</main>
      </body>
    </html>
  )
}

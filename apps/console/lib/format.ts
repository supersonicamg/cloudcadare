const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })
const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })

export const formatDate = (d: Date | null | undefined) => (d ? date.format(d) : '—')
export const formatDateTime = (d: Date | null | undefined) => (d ? dateTime.format(d) : '—')

/** Link to an academy from the console. Local development serves academies on plain http, port 3000. */
export function academyUrl(host: string): string {
  const local = host === 'localhost' || host.endsWith('.localhost')
  return local ? `http://${host}:${process.env.ACADEMY_DEV_PORT ?? '3000'}` : `https://${host}`
}

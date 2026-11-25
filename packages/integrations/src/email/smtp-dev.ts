import net from 'node:net'
import { assertHeaderSafe, type EmailSender } from './port'

// A minimal SMTP client for the local mail sink (packages/db/scripts/smtp-sink.mjs) so development shows real mail.
// No TLS, no auth: it refuses to talk to anything but a loopback host, and the app never selects it in production.

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1'])

function address(v: string) {
  const m = /<([^>]+)>/.exec(v)
  return (m ? m[1]! : v).trim()
}

export function smtpDev(host = '127.0.0.1', port = 54325): EmailSender {
  if (!LOOPBACK.has(host)) throw new Error('smtp-dev only talks to a loopback host')
  return {
    name: 'smtp-dev',
    send(m) {
      assertHeaderSafe(m.from, m.to, m.subject, m.replyTo)
      const body = [
        `From: ${m.from}`, `To: ${m.to}`, `Subject: ${m.subject}`, 'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', m.text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..'),
      ].join('\r\n')
      const steps = ['EHLO app', `MAIL FROM:<${address(m.from)}>`, `RCPT TO:<${address(m.to)}>`, 'DATA', `${body}\r\n.`, 'QUIT']
      return new Promise((resolve, reject) => {
        const sock = net.connect(port, host)
        let i = 0
        let buf = ''
        const fail = (e: Error) => { sock.destroy(); reject(e) }
        sock.setTimeout(8000, () => fail(new Error('SMTP timeout')))
        sock.on('error', fail)
        sock.on('data', (d) => {
          buf += d.toString('utf8')
          while (buf.includes('\r\n')) {
            const line = buf.slice(0, buf.indexOf('\r\n'))
            buf = buf.slice(buf.indexOf('\r\n') + 2)
            if (/^[45]/.test(line)) return fail(new Error(`SMTP error: ${line}`))
            if (i < steps.length) sock.write(`${steps[i++]}\r\n`)
            else { sock.end(); return resolve({ id: null }) }
          }
        })
      })
    },
  }
}

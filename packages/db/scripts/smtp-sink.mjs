#!/usr/bin/env node
// Tiny local SMTP sink for development: accepts any mail and prints it. No dependencies.
//   node packages/db/scripts/smtp-sink.mjs          (listens on :54325; Supabase Auth is pointed here in config.toml)
import net from 'node:net'
import { appendFileSync } from 'node:fs'

const PORT = Number(process.env.SMTP_SINK_PORT ?? 54325)
const LOG = process.env.SMTP_SINK_LOG ?? '/tmp/educore-mail.log'

net.createServer((sock) => {
  let data = false, buf = '', body = '', to = ''
  const send = (s) => sock.write(s + '\r\n')
  send('220 sink ESMTP')
  sock.on('data', (chunk) => {
    buf += chunk.toString('utf8')
    for (;;) {
      if (data) {
        const end = buf.indexOf('\r\n.\r\n')
        if (end < 0) { return }
        body = buf.slice(0, end); buf = buf.slice(end + 5); data = false
        const text = body.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        const line = `[${new Date().toISOString()}] to=${to}\n${text}\n----\n`
        appendFileSync(LOG, line); process.stdout.write(line)
        send('250 queued'); continue
      }
      const i = buf.indexOf('\r\n'); if (i < 0) return
      const cmd = buf.slice(0, i); buf = buf.slice(i + 2)
      const u = cmd.toUpperCase()
      if (u.startsWith('EHLO') || u.startsWith('HELO')) send('250 sink')
      else if (u.startsWith('RCPT TO')) { to = cmd.slice(8).replace(/[<>]/g, '').trim(); send('250 ok') }
      else if (u.startsWith('DATA')) { data = true; send('354 go') }
      else if (u.startsWith('QUIT')) { send('221 bye'); sock.end() }
      else send('250 ok')
    }
  })
  sock.on('error', () => {})
}).listen(PORT, '0.0.0.0', () => console.log(`smtp sink on :${PORT}, log ${LOG}`))

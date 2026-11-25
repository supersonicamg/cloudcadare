// Sign-up and sign-in with email + password, shared by the academy app and the console.
// There is no mail server, so nothing here is verified: an email address or WhatsApp number is what the person typed.
import { z } from 'zod'

export const PASSWORD_MIN = 8
/** Supabase Auth (bcrypt) ignores anything past 72 characters, so it rejects longer passwords. */
export const PASSWORD_MAX = 72

export type AccountField = 'name' | 'email' | 'whatsapp' | 'password'
export interface AccountError { error: string; field?: AccountField }
type Parsed<T> = { ok: true; data: T } | ({ ok: false } & AccountError)

/** Stored as +<country><number>. A bare 10-digit mobile number is read as Indian (+91). */
export function normaliseWhatsapp(raw: string): string | null {
  let n = raw.replace(/[\s().-]/g, '')
  if (n.startsWith('00')) n = `+${n.slice(2)}`
  else if (/^0?[6-9]\d{9}$/.test(n)) n = `+91${n.slice(-10)}`
  else if (/^91[6-9]\d{9}$/.test(n)) n = `+${n}`
  if (n.startsWith('+91') && !/^\+91[6-9]\d{9}$/.test(n)) return null
  return /^\+[1-9]\d{7,14}$/.test(n) ? n : null
}

/** Only a path on this site. "//host" and "/\host" are read by browsers as another site. */
export function safeNext(raw: unknown): string {
  return typeof raw === 'string' && /^\/(?![/\\])[^\\\u0000-\u001f]*$/.test(raw) ? raw : '/'
}

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254, 'Enter a valid email address.'))

const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(80, 'Keep your name under 80 characters.'),
  email,
  whatsapp: z.string().transform((raw, ctx) => {
    const n = normaliseWhatsapp(raw)
    if (n) return n
    ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit mobile number, or start with + and your country code.' })
    return z.NEVER
  }),
  password: z.string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
})

// No length rule beyond "not empty": an older password must still be able to sign in.
const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.').max(PASSWORD_MAX, 'Wrong email or password.') })

function parse<T>(schema: z.ZodType<T>, form: FormData, keys: AccountField[]): Parsed<T> {
  const r = schema.safeParse(Object.fromEntries(keys.map((k) => [k, text(form, k)])))
  if (r.success) return { ok: true, data: r.data }
  const issue = r.error.issues[0]!
  return { ok: false, error: issue.message, field: issue.path[0] as AccountField }
}

export const parseSignUp = (form: FormData) => parse(signUpSchema, form, ['name', 'email', 'whatsapp', 'password'])
export const parseLogin = (form: FormData) => parse(loginSchema, form, ['email', 'password'])

/** What to tell the person when Supabase Auth refuses. */
export function describeAuthError(e: { code?: string; status?: number }, during: 'signup' | 'login'): AccountError {
  if (e.status === 429) return { error: 'Too many tries. Wait a few minutes and try again.' }
  switch (e.code) {
    case 'invalid_credentials': return { error: 'Wrong email or password.' }
    case 'user_already_exists':
    case 'email_exists': return { error: 'An account with this email already exists. Sign in instead.', field: 'email' }
    case 'email_address_invalid': return { error: 'Enter a valid email address.', field: 'email' }
    case 'weak_password': return { error: 'Choose a stronger password.', field: 'password' }
    case 'signup_disabled': return { error: 'New accounts are switched off at the moment.' }
    default: return { error: during === 'signup' ? 'We could not create your account. Try again in a minute.' : 'We could not sign you in. Try again in a minute.' }
  }
}

export * from './learner-list'

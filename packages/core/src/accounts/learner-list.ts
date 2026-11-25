// Parsing of a pasted learner list (plan/16 §4.4). Pure, so the form can preview it and the server action can use the
// exact same rules. Matching later is exact on lower(trim(email)): there are no wildcards and no whole-domain entries.

export const LIST_MAX = 500
const EMAIL = /^[^@\s,;*%?\\]+@[^@\s,;*%?]+\.[^@\s,;*%?]+$/

export interface ListEntry { email: string; name?: string }
export interface ParsedList { valid: ListEntry[]; invalid: string[]; repeats: string[]; tooMany: boolean }

/**
 * Accepts what people paste: one address per line, several separated by commas, semicolons, tabs or spaces, a column
 * copied from a spreadsheet, or CSV lines like `anita@example.com,Anita Desai`. On a line with one address, the rest of
 * the line is the name; on a line with several addresses, all of it is addresses.
 */
export function parseLearnerList(raw: string): ParsedList {
  const valid: ListEntry[] = []
  const invalid: string[] = []
  const repeats: string[] = []
  const seen = new Set<string>()
  const add = (email: string, name?: string) => {
    const e = email.trim().toLowerCase().replace(/^["'<]+|["'>]+$/g, '')
    if (!EMAIL.test(e) || e.length > 254) { invalid.push(e); return }
    if (seen.has(e)) { repeats.push(e); return }
    seen.add(e)
    const n = name?.trim().replace(/^["']+|["']+$/g, '').slice(0, 120)
    valid.push(n ? { email: e, name: n } : { email: e })
  }

  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    const tokens = text.split(/[\s,;\t]+/).filter(Boolean)
    const withAt = tokens.filter((t) => t.includes('@'))
    if (withAt.length <= 1) {
      // `email, name` or just `email`. A line with no "@" at all is one wrong entry, not several.
      const at = tokens.findIndex((t) => t.includes('@'))
      if (at === -1) { invalid.push(text.slice(0, 120)); continue }
      const name = tokens.filter((_t, i) => i !== at).join(' ')
      add(tokens[at]!, name || undefined)
    } else {
      for (const t of tokens) add(t)
    }
  }
  return { valid: valid.slice(0, LIST_MAX), invalid, repeats, tooMany: valid.length > LIST_MAX }
}

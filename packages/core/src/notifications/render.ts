// Pure helpers for turning a stored template into an email (no I/O, unit tested).

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Replaces {{a.b}} with vars["a.b"]. Unknown names become empty text, never an error; values are plain text. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, name: string) => vars[name] ?? '')
}

/** Plain text to simple, safe HTML: escaped, paragraphs for blank lines, and https links made clickable. */
export function textToHtml(text: string): string {
  const para = (p: string) =>
    `<p>${escapeHtml(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${u}</a>`)}</p>`
  return text.trim().split(/\n{2,}/).map(para).join('\n')
}

/** A display name that is safe inside a `"Name" <address>` header. */
export const safeDisplayName = (name: string) => name.replace(/["<>\r\n\\]/g, '').trim().slice(0, 80) || 'Academy'

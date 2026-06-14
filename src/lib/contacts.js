/** Parse `First Last <a@b.co>` into { name, email }. Returns null otherwise. */
export function parseContact(value) {
  const m = value.match(/^\s*(.+?)\s*<([^>]+@[^>]+)>\s*$/)
  return m ? { name: m[1].trim(), email: m[2].trim() } : null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** True if the trimmed value looks like a bare email address. */
export function isEmail(value) {
  return EMAIL_RE.test(value.trim())
}

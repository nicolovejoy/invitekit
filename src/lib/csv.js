const CSV_HEADER = 'name,email,rsvp,guestCount'

/** Serialize invites to a CSV string with a header row. */
export function serializeGuests(invites) {
  const rows = invites.map(i =>
    [i.name, i.email, i.rsvp || '', i.guestCount ?? 1]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  return [CSV_HEADER, ...rows].join('\n')
}

/** Parse pasted CSV/TSV guest rows into { guests: [{ name, email }], skipped }.
 *  Skips a leading header row, rows missing a name/valid email, and emails that
 *  already appear in `existingEmails` (a Set of lowercased emails) or earlier in
 *  the input. The caller's set is not mutated. */
export function parseGuests(text, existingEmails = new Set()) {
  const seen = new Set(existingEmails)
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length === 0) return { guests: [], skipped: 0 }

  const start = /^name[,\t]/i.test(lines[0]) ? 1 : 0
  const guests = []
  let skipped = 0

  for (let i = start; i < lines.length; i++) {
    // Support CSV (comma) and TSV (tab), with optional surrounding quotes.
    const parts = lines[i].includes('\t')
      ? lines[i].split('\t').map(s => s.trim().replace(/^"|"$/g, ''))
      : lines[i].match(/(".*?"|[^,]+)/g)?.map(s => s.trim().replace(/^"|"$/g, '')) || []
    const name = parts[0]?.trim()
    const email = parts[1]?.trim()
    if (!name || !email || !email.includes('@')) { skipped++; continue }
    const key = email.toLowerCase()
    if (seen.has(key)) { skipped++; continue }
    seen.add(key)
    guests.push({ name, email })
  }

  return { guests, skipped }
}

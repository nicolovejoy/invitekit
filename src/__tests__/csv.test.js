import { describe, it, expect } from 'vitest'
import { serializeGuests, parseGuests } from '@/lib/csv'

describe('serializeGuests', () => {
  it('writes a header and one quoted row per invite', () => {
    const csv = serializeGuests([{ name: 'Ann', email: 'a@x.com', rsvp: 'attending', guestCount: 2 }])
    expect(csv).toBe('name,email,rsvp,guestCount\n"Ann","a@x.com","attending","2"')
  })
  it('defaults missing rsvp to empty and guestCount to 1', () => {
    const csv = serializeGuests([{ name: 'Bo', email: 'b@x.com' }])
    expect(csv).toBe('name,email,rsvp,guestCount\n"Bo","b@x.com","","1"')
  })
  it('escapes embedded double quotes', () => {
    const csv = serializeGuests([{ name: 'A "Ace" B', email: 'a@x.com', guestCount: 1 }])
    expect(csv).toContain('"A ""Ace"" B"')
  })
  it('produces just the header for an empty list', () => {
    expect(serializeGuests([])).toBe('name,email,rsvp,guestCount')
  })
})

describe('parseGuests', () => {
  it('parses comma-separated rows', () => {
    const { guests, skipped } = parseGuests('Ann, a@x.com\nBo, b@x.com')
    expect(guests).toEqual([{ name: 'Ann', email: 'a@x.com' }, { name: 'Bo', email: 'b@x.com' }])
    expect(skipped).toBe(0)
  })
  it('parses tab-separated rows', () => {
    const { guests } = parseGuests('Ann\ta@x.com')
    expect(guests).toEqual([{ name: 'Ann', email: 'a@x.com' }])
  })
  it('skips a header row', () => {
    const { guests } = parseGuests('name,email\nAnn,a@x.com')
    expect(guests).toEqual([{ name: 'Ann', email: 'a@x.com' }])
  })
  it('strips surrounding quotes', () => {
    const { guests } = parseGuests('"Ann","a@x.com"')
    expect(guests).toEqual([{ name: 'Ann', email: 'a@x.com' }])
  })
  it('skips rows missing a name or a valid email', () => {
    const { guests, skipped } = parseGuests('Ann, a@x.com\n, b@x.com\nCarol, not-an-email')
    expect(guests).toEqual([{ name: 'Ann', email: 'a@x.com' }])
    expect(skipped).toBe(2)
  })
  it('dedupes against existing emails (case-insensitive) without mutating the set', () => {
    const existing = new Set(['a@x.com'])
    const { guests, skipped } = parseGuests('Ann, A@X.com\nBo, b@x.com', existing)
    expect(guests).toEqual([{ name: 'Bo', email: 'b@x.com' }])
    expect(skipped).toBe(1)
    expect(existing.has('b@x.com')).toBe(false)
  })
  it('dedupes duplicates within the input', () => {
    const { guests, skipped } = parseGuests('Ann, a@x.com\nAnnie, a@x.com')
    expect(guests).toEqual([{ name: 'Ann', email: 'a@x.com' }])
    expect(skipped).toBe(1)
  })
  it('returns empty for blank input', () => {
    expect(parseGuests('   ')).toEqual({ guests: [], skipped: 0 })
  })
})

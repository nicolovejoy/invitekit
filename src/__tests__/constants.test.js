import { describe, it, expect } from 'vitest'
import {
  formatTime,
  formatTimeRange,
  formatDate,
  formatTimezone,
  formatTimeWithZone,
  buildInviteText,
  escapeHtml,
  magicLink,
} from '@/lib/constants'

describe('formatTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatTime('')).toBe('')
    expect(formatTime(undefined)).toBe('')
  })
  it('formats afternoon times as PM', () => {
    expect(formatTime('18:00')).toBe('6:00 PM')
    expect(formatTime('13:05')).toBe('1:05 PM')
  })
  it('formats morning times as AM', () => {
    expect(formatTime('09:05')).toBe('9:05 AM')
  })
  it('handles midnight as 12 AM', () => {
    expect(formatTime('00:00')).toBe('12:00 AM')
  })
  it('handles noon as 12 PM', () => {
    expect(formatTime('12:00')).toBe('12:00 PM')
  })
  it('zero-pads minutes', () => {
    expect(formatTime('08:03')).toBe('8:03 AM')
  })
})

describe('formatTimeRange', () => {
  it('returns just the start when no end time', () => {
    expect(formatTimeRange('18:00')).toBe('6:00 PM')
  })
  it('joins start and end with an en dash', () => {
    expect(formatTimeRange('18:00', '21:00')).toBe('6:00 PM – 9:00 PM')
  })
})

describe('formatDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('')
  })
  it('formats an ISO date as weekday, month day', () => {
    // 2026-05-10 is a Sunday
    expect(formatDate('2026-05-10')).toBe('Sunday, May 10')
  })
  it('parses the date in local time (no off-by-one)', () => {
    expect(formatDate('2026-01-01')).toContain('January 1')
  })
})

describe('formatTimezone', () => {
  it('returns empty string for falsy input', () => {
    expect(formatTimezone('')).toBe('')
  })
  it('returns a stable abbreviation for a no-DST zone', () => {
    // Arizona never observes DST → always MST
    expect(formatTimezone('America/Phoenix')).toBe('MST')
    expect(formatTimezone('Pacific/Honolulu')).toBe('HST')
  })
  it('returns a DST-aware abbreviation for Eastern', () => {
    expect(formatTimezone('America/New_York')).toMatch(/^E[SD]T$/)
  })
  it('returns empty string for an invalid zone', () => {
    expect(formatTimezone('Not/AZone')).toBe('')
  })
})

describe('formatTimeWithZone', () => {
  it('omits the zone when none given', () => {
    expect(formatTimeWithZone('18:00', '21:00')).toBe('6:00 PM – 9:00 PM')
  })
  it('appends a stable zone abbreviation', () => {
    expect(formatTimeWithZone('18:00', null, 'America/Phoenix')).toBe('6:00 PM MST')
  })
})

describe('buildInviteText', () => {
  const base = {
    name: 'Jordan',
    title: 'Dinner at the Loft',
    date: '2026-05-10',
    time: '18:00',
    endTime: '21:00',
    timezone: 'America/Phoenix',
    location: '123 Main St',
    token: 'abc-123',
  }
  it('greets the guest and links to the RSVP page', () => {
    const text = buildInviteText(base)
    expect(text).toContain('Hi Jordan,')
    expect(text).toContain('Dinner at the Loft')
    expect(text).toContain('6:00 PM – 9:00 PM MST')
    expect(text).toContain(`RSVP here: ${magicLink('abc-123')}`)
  })
  it('includes the description when present', () => {
    expect(buildInviteText({ ...base, description: 'Bring wine!' })).toContain('Bring wine!')
  })
  it('omits the description block when absent', () => {
    const text = buildInviteText(base)
    expect(text).not.toContain('undefined')
  })
})

describe('escapeHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
  it('escapes all five entities', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;'
    )
  })
})

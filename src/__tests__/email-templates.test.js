import { describe, it, expect } from 'vitest'
import {
  inviteSubject,
  buildInviteEmail,
  buildInvitePlainText,
  reminderSubject,
  buildReminderEmail,
  nudgeSubject,
  thankYouSubject,
  buildThankYouEmail,
  buildThankYouPlainText,
  buildCustomEmail,
  buildCustomPlainText,
  defaultDraftBody,
} from '@/lib/email-templates'

// Shared test fixtures
const event = {
  title: 'Dinner at the Loft',
  date: '2026-05-10',
  time: '18:00',
  endTime: '21:00',
  timezone: 'America/New_York',
  location: '123 Main St',
  description: 'Bring wine!',
}

const invite = {
  name: 'Jordan',
  email: 'guest@example.com',
}

const link = 'https://free-vite.com/rsvp/abc-123'

// --- Subject lines ---

describe('email subject lines', () => {
  it('invite subject includes event title', () => {
    expect(inviteSubject(event)).toBe("You're invited: Dinner at the Loft")
  })

  it('reminder subject includes event title', () => {
    expect(reminderSubject(event)).toBe('Reminder: Dinner at the Loft')
  })

  it('nudge subject includes event title', () => {
    expect(nudgeSubject(event)).toBe("Reminder: You're invited to Dinner at the Loft")
  })

  it('thank-you subject includes event title', () => {
    expect(thankYouSubject(event)).toBe('Thank you — Dinner at the Loft')
  })
})

// --- Invite email ---

describe('buildInviteEmail', () => {
  it('contains the guest name', () => {
    const html = buildInviteEmail({ invite, event, link })
    expect(html).toContain('Hi Jordan,')
  })

  it('contains the RSVP link', () => {
    const html = buildInviteEmail({ invite, event, link })
    expect(html).toContain('href="https://free-vite.com/rsvp/abc-123"')
  })

  it('contains event details', () => {
    const html = buildInviteEmail({ invite, event, link })
    expect(html).toContain('Dinner at the Loft')
    expect(html).toContain('123 Main St')
  })

  it('includes description when present', () => {
    const html = buildInviteEmail({ invite, event, link })
    expect(html).toContain('Bring wine!')
  })

  it('omits description when absent', () => {
    const noDesc = { ...event, description: '' }
    const html = buildInviteEmail({ invite, event: noDesc, link })
    expect(html).not.toContain('Bring wine!')
  })

  it('escapes HTML in guest name', () => {
    const xssInvite = { ...invite, name: '<script>alert("xss")</script>' }
    const html = buildInviteEmail({ invite: xssInvite, event, link })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

// --- Invite plain text ---

describe('buildInvitePlainText', () => {
  it('contains guest name and event title', () => {
    const text = buildInvitePlainText({ invite, event, link })
    expect(text).toContain('Hi Jordan,')
    expect(text).toContain('Dinner at the Loft')
  })

  it('contains the RSVP link', () => {
    const text = buildInvitePlainText({ invite, event, link })
    expect(text).toContain('https://free-vite.com/rsvp/abc-123')
  })

  it('does not contain HTML tags', () => {
    const text = buildInvitePlainText({ invite, event, link })
    expect(text).not.toMatch(/<[a-z][\s\S]*>/i)
  })
})

// --- Thank-you email ---

describe('buildThankYouEmail', () => {
  it('shows attending message for attending status', () => {
    const html = buildThankYouEmail({ invite, event, link, rsvpStatus: 'attending' })
    expect(html).toContain('looking forward to seeing you')
  })

  it('shows declined message for declined status', () => {
    const html = buildThankYouEmail({ invite, event, link, rsvpStatus: 'declined' })
    expect(html).toContain("We'll miss you")
  })

  it('shows maybe message for maybe status', () => {
    const html = buildThankYouEmail({ invite, event, link, rsvpStatus: 'maybe' })
    expect(html).toContain('hope you can make it')
  })

  it('falls back to attending for unknown status', () => {
    const html = buildThankYouEmail({ invite, event, link, rsvpStatus: 'unknown' })
    expect(html).toContain('looking forward to seeing you')
  })
})

describe('buildThankYouPlainText', () => {
  it('contains no HTML tags', () => {
    const text = buildThankYouPlainText({ invite, event, link, rsvpStatus: 'attending' })
    expect(text).not.toMatch(/<[a-z][\s\S]*>/i)
  })
})

// --- Custom email ---

describe('buildCustomEmail', () => {
  it('replaces {name} placeholder with guest name', () => {
    const html = buildCustomEmail({ invite, body: 'Hey {name}, see you there!', link })
    expect(html).toContain('Hey Jordan, see you there!')
    expect(html).not.toContain('{name}')
  })

  it('includes the invite link', () => {
    const html = buildCustomEmail({ invite, body: 'Hello', link })
    expect(html).toContain('href="https://free-vite.com/rsvp/abc-123"')
  })
})

describe('buildCustomPlainText', () => {
  it('replaces {name} and includes link', () => {
    const text = buildCustomPlainText({ invite, body: 'Hi {name}!', link })
    expect(text).toContain('Hi Jordan!')
    expect(text).toContain('https://free-vite.com/rsvp/abc-123')
  })
})

// --- Reminder email guest count ---

describe('buildReminderEmail guest count', () => {
  it('shows guest count when bringing extras', () => {
    const plusOne = { ...invite, guestCount: 3 }
    const html = buildReminderEmail({ invite: plusOne, event, link })
    expect(html).toContain('×3')
  })

  it('omits guest count for solo guest', () => {
    const solo = { ...invite, guestCount: 1 }
    const html = buildReminderEmail({ invite: solo, event, link })
    expect(html).not.toContain('×')
  })
})

// --- Sender address ---

describe('sender email constant', () => {
  it('defaults to free-vite.com domain', async () => {
    const { SENDER_EMAIL } = await import('@/lib/constants')
    expect(SENDER_EMAIL).toContain('free-vite.com')
    expect(SENDER_EMAIL).not.toContain('soiree')
  })
})

// --- Default draft body ---

describe('defaultDraftBody', () => {
  it('includes event title and date', () => {
    const body = defaultDraftBody(event)
    expect(body).toContain('Dinner at the Loft')
    expect(body).toContain('{name}')
  })
})

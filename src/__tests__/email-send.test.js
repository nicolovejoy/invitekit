import { describe, it, expect, vi, beforeEach } from 'vitest'

// Exercises the registry-specific behavior the shared send-invite test doesn't:
// custom-email field validation + skip-update, and thank-you's rsvpStatus wiring.

const mockGet = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: () => ({ doc: () => ({ get: mockGet, update: mockUpdate }) }),
  }),
  getAdminAuth: () => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'org-1', 'freevite:organizer': true }),
  }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const event = { title: 'Loft Dinner', date: '2026-05-10', time: '18:00', createdBy: 'org-1' }

function req(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer organizer-token' },
    body: JSON.stringify(body),
  })
}

function bothDocsExist(inviteData) {
  let n = 0
  mockGet.mockImplementation(async () => {
    n++
    return n === 1 ? { exists: true, data: () => inviteData } : { exists: true, data: () => event }
  })
}

const { POST: sendCustom } = await import('@/app/api/send-custom/route')
const { POST: sendThankYou } = await import('@/app/api/send-thank-you/route')

describe('send-custom (registry: requireFields + skipUpdateIfSet)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects when subject or body is missing', async () => {
    bothDocsExist({ email: 'g@x.com' })
    expect((await sendCustom(req('http://localhost/api/send-custom', { token: 'a', eventId: 'e', body: 'hi' }))).status).toBe(400)
    expect((await sendCustom(req('http://localhost/api/send-custom', { token: 'a', eventId: 'e', subject: 's' }))).status).toBe(400)
  })

  it('sends with the supplied subject and does not re-stamp an already-sent invite', async () => {
    bothDocsExist({ email: 'g@x.com', name: 'Sam', emailSentAt: { _seconds: 1 } })
    mockFetch.mockResolvedValueOnce({ ok: true })
    const res = await sendCustom(req('http://localhost/api/send-custom', {
      token: 'a', eventId: 'e', subject: 'Menu update', body: 'Hi {name}, note the time.',
    }))
    expect(res.status).toBe(200)
    const sent = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(sent.subject).toBe('Menu update')
    expect(sent.html).toContain('Hi Sam,')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('stamps emailSentAt on a not-yet-emailed invite', async () => {
    bothDocsExist({ email: 'g@x.com', name: 'Sam' })
    mockFetch.mockResolvedValueOnce({ ok: true })
    await sendCustom(req('http://localhost/api/send-custom', {
      token: 'a', eventId: 'e', subject: 's', body: 'b',
    }))
    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockUpdate.mock.calls[0][0]).toHaveProperty('emailSentAt')
  })
})

describe('send-thank-you (registry: rsvpStatus wiring)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reflects the declined RSVP copy and stamps thankYouSentAt', async () => {
    bothDocsExist({ email: 'g@x.com', name: 'Sam', rsvp: 'declined' })
    mockFetch.mockResolvedValueOnce({ ok: true })
    const res = await sendThankYou(req('http://localhost/api/send-thank-you', { token: 'a', eventId: 'e' }))
    expect(res.status).toBe(200)
    const sent = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(sent.text).toContain("We'll miss you")
    expect(mockUpdate.mock.calls[0][0]).toHaveProperty('thankYouSentAt')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockGet = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({ get: mockGet, update: mockUpdate }),
    }),
  }),
  getAdminAuth: () => ({
    verifyIdToken: vi.fn().mockImplementation(async (token) => {
      if (token === 'bad-token') throw new Error('Invalid token')
      if (token === 'guest-token') return { uid: 'guest-1' }
      return { uid: 'org-1', 'freevite:organizer': true }
    }),
  }),
}))

// Capture what gets sent to Resend
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// --- Fixtures ---

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

function makeRequest(body, token = 'organizer-token') {
  return new Request('http://localhost/api/send-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

// --- Tests ---

// Import after mocks are set up
const { POST } = await import('@/app/api/send-invite/route')

describe('POST /api/send-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: both docs exist
    mockGet.mockResolvedValue({ exists: true, data: () => invite })
  })

  // -- Auth --

  it('rejects request with no auth header', async () => {
    const req = new Request('http://localhost/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'abc', eventId: 'evt1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('rejects invalid token', async () => {
    const req = makeRequest({ token: 'abc', eventId: 'evt1' }, 'bad-token')
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Invalid token' })
  })

  it('rejects non-organizer user', async () => {
    const req = makeRequest({ token: 'abc', eventId: 'evt1' }, 'guest-token')
    const res = await POST(req)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Not authorized' })
  })

  // -- Validation --

  it('rejects missing token', async () => {
    const req = makeRequest({ eventId: 'evt1' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects missing eventId', async () => {
    const req = makeRequest({ token: 'abc' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('rejects invalid JSON body', async () => {
    const req = new Request('http://localhost/api/send-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer organizer-token',
      },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  // -- Not found --

  it('returns 404 when invite doc missing', async () => {
    let callCount = 0
    mockGet.mockImplementation(async () => {
      callCount++
      // First call is invite, second is event
      if (callCount === 1) return { exists: false }
      return { exists: true, data: () => event }
    })
    const req = makeRequest({ token: 'abc', eventId: 'evt1' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 404 when event doc missing', async () => {
    let callCount = 0
    mockGet.mockImplementation(async () => {
      callCount++
      if (callCount === 1) return { exists: true, data: () => invite }
      return { exists: false }
    })
    const req = makeRequest({ token: 'abc', eventId: 'evt1' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  // -- Happy path --

  it('sends email via Resend and updates Firestore', async () => {
    let callCount = 0
    mockGet.mockImplementation(async () => {
      callCount++
      if (callCount === 1) return { exists: true, data: () => invite }
      return { exists: true, data: () => event }
    })
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockUpdate.mockResolvedValueOnce()

    const req = makeRequest({ token: 'abc-123', eventId: 'evt1' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    // Verify Resend was called correctly
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(opts.method).toBe('POST')

    const body = JSON.parse(opts.body)
    expect(body.to).toBe('guest@example.com')
    expect(body.from).toContain('free-vite.com')
    expect(body.subject).toBe("You're invited: Dinner at the Loft")
    expect(body.html).toContain('Hi Jordan,')
    expect(body.html).toContain('href="https://free-vite.com/rsvp/abc-123"')
    expect(body.text).toContain('Hi Jordan,')

    // Verify Firestore update
    expect(mockUpdate).toHaveBeenCalledOnce()
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg).toHaveProperty('emailSentAt')
  })

  // -- Resend failure --

  it('returns 502 when Resend API fails', async () => {
    let callCount = 0
    mockGet.mockImplementation(async () => {
      callCount++
      if (callCount === 1) return { exists: true, data: () => invite }
      return { exists: true, data: () => event }
    })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => '{"message":"Rate limit exceeded"}',
    })

    const req = makeRequest({ token: 'abc', eventId: 'evt1' })
    const res = await POST(req)

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('Rate limit')
  })
})

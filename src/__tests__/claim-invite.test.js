import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockInviteGet = vi.fn()
const mockInviteUpdate = vi.fn()
const mockEventGet = vi.fn()

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: (name) => ({
      doc: () =>
        name === 'invites'
          ? { get: mockInviteGet, update: mockInviteUpdate }
          : { get: mockEventGet },
    }),
  }),
}))

// --- Fixtures ---

const VALID_TOKEN = '123e4567-e89b-12d3-a456-426614174000'

function makeRequest(body) {
  return new Request('http://localhost/api/claim-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const { POST } = await import('@/app/api/claim-invite/route')

describe('POST /api/claim-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing token or uid', async () => {
    expect((await POST(makeRequest({ uid: 'u1' }))).status).toBe(400)
    expect((await POST(makeRequest({ token: VALID_TOKEN }))).status).toBe(400)
  })

  it('rejects invalid JSON body', async () => {
    expect((await POST(makeRequest('not json'))).status).toBe(400)
  })

  it('rejects a malformed token', async () => {
    const res = await POST(makeRequest({ token: 'not-a-uuid', uid: 'u1' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid token format')
  })

  it('returns 404 when the invite does not exist', async () => {
    mockInviteGet.mockResolvedValue({ exists: false })
    const res = await POST(makeRequest({ token: VALID_TOKEN, uid: 'u1' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when already claimed by another user', async () => {
    mockInviteGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'someone-else' }) })
    const res = await POST(makeRequest({ token: VALID_TOKEN, uid: 'u1' }))
    expect(res.status).toBe(409)
  })

  it('returns 410 when the event has ended', async () => {
    mockInviteGet.mockResolvedValue({ exists: true, data: () => ({ uid: null, eventId: 'evt1' }) })
    mockEventGet.mockResolvedValue({ exists: true, data: () => ({ date: '2000-01-01' }) })
    const res = await POST(makeRequest({ token: VALID_TOKEN, uid: 'u1' }))
    expect(res.status).toBe(410)
    expect(mockInviteUpdate).not.toHaveBeenCalled()
  })

  it('claims an unclaimed invite for a future event', async () => {
    mockInviteGet.mockResolvedValue({ exists: true, data: () => ({ uid: null, eventId: 'evt1' }) })
    mockEventGet.mockResolvedValue({ exists: true, data: () => ({ date: '2099-01-01' }) })
    mockInviteUpdate.mockResolvedValue()
    const res = await POST(makeRequest({ token: VALID_TOKEN, uid: 'u1' }))
    expect(res.status).toBe(200)
    expect(mockInviteUpdate).toHaveBeenCalledWith({ uid: 'u1' })
  })

  it('is idempotent when re-claimed by the same user', async () => {
    mockInviteGet.mockResolvedValue({ exists: true, data: () => ({ uid: 'u1', eventId: 'evt1' }) })
    mockEventGet.mockResolvedValue({ exists: true, data: () => ({ date: '2099-01-01' }) })
    mockInviteUpdate.mockResolvedValue()
    const res = await POST(makeRequest({ token: VALID_TOKEN, uid: 'u1' }))
    expect(res.status).toBe(200)
  })
})

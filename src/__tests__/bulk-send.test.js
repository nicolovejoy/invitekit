import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('id-token') } },
}))

const { sendBulk } = await import('@/lib/bulk-send')

const buildRequest = (invite) => ({ url: '/api/send-x', body: { id: invite.id } })

beforeEach(() => {
  vi.clearAllMocks()
  // Make the inter-send pause instant.
  vi.stubGlobal('setTimeout', (fn) => { fn(); return 0 })
})

describe('sendBulk', () => {
  it('counts successes and reports final progress', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const onProgress = vi.fn()
    const result = await sendBulk({
      targets: [{ id: 1 }, { id: 2 }, { id: 3 }],
      buildRequest,
      onProgress,
    })
    expect(result).toEqual({ sent: 3, failed: 0 })
    // initial call + one per target
    expect(onProgress).toHaveBeenCalledWith({ sent: 0, total: 3 })
    expect(onProgress).toHaveBeenLastCalledWith({ sent: 3, total: 3 })
    expect(onProgress).toHaveBeenCalledTimes(4)
  })

  it('counts non-ok responses and thrown requests as failures', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('network'))
    vi.stubGlobal('fetch', fetch)
    const result = await sendBulk({
      targets: [{ id: 1 }, { id: 2 }, { id: 3 }],
      buildRequest,
      onProgress: vi.fn(),
    })
    expect(result).toEqual({ sent: 1, failed: 2 })
  })

  it('authorizes each request with the current ID token', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetch)
    await sendBulk({ targets: [{ id: 7 }], buildRequest, onProgress: vi.fn() })
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('/api/send-x')
    expect(opts.headers.Authorization).toBe('Bearer id-token')
    expect(JSON.parse(opts.body)).toEqual({ id: 7 })
  })
})

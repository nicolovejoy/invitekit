import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }) => <a href={href} {...props}>{children}</a>,
}))

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn().mockResolvedValue({ user: { getIdToken: vi.fn().mockResolvedValue('token') } }),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}))

// Mock firebase client
vi.mock('@/lib/firebase', () => ({
  auth: {},
  db: {},
}))

// Must use vi.hoisted so the mock fn is available before vi.mock hoisting
const mockUseAuth = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}))

// Import after mocks
import Header from '@/components/Header'

describe('Header', () => {
  afterEach(cleanup)

  it('shows sign-in button when no user is logged in', () => {
    mockUseAuth.mockReturnValue({ user: null, isOrganizer: false, loading: false })
    render(<Header />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows sign-in button when user is anonymous (BUG: was missing)', () => {
    mockUseAuth.mockReturnValue({
      user: { isAnonymous: true, uid: 'anon-123' },
      isOrganizer: false,
      loading: false,
    })
    render(<Header />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows sign-out button for authenticated non-anonymous user', () => {
    mockUseAuth.mockReturnValue({
      user: { isAnonymous: false, uid: 'user-456', email: 'test@example.com' },
      isOrganizer: false,
      loading: false,
    })
    render(<Header />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('shows dashboard and new event links for organizers', () => {
    mockUseAuth.mockReturnValue({
      user: { isAnonymous: false, uid: 'org-789', email: 'organizer@example.com' },
      isOrganizer: true,
      loading: false,
    })
    render(<Header />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /new event/i })).toBeInTheDocument()
  })

  it('shows nothing when loading', () => {
    mockUseAuth.mockReturnValue({ user: undefined, isOrganizer: false, loading: true })
    render(<Header />)
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })
})

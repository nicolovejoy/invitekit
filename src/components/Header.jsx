'use client'

import Link from 'next/link'
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export default function Header() {
  const { user, isOrganizer, loading } = useAuth()

  async function handleSignIn() {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      const idToken = await result.user.getIdToken()
      await fetch('/api/set-organizer-claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      })
      await result.user.getIdToken(true)
    } catch (err) {
      console.error('[auth] sign-in error:', err)
    }
  }

  return (
    <header className="border-b px-4 py-3 flex items-center justify-between">
      <div>
        <Link href={isOrganizer ? '/dashboard' : '/'} className="font-semibold tracking-tight">Freevite</Link>
        {process.env.NEXT_PUBLIC_BUILD_TIME && (
          <span className="text-[10px] text-muted-foreground ml-2">{process.env.NEXT_PUBLIC_BUILD_TIME}</span>
        )}
      </div>
      {!loading && (
        <div className="flex items-center gap-2">
          {isOrganizer && (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/events/new">New Event</Link>
              </Button>
            </>
          )}
          {user && !user.isAnonymous ? (
            <Button variant="outline" size="sm" onClick={() => signOut(auth)}>
              Sign out
            </Button>
          ) : (
            <Button size="sm" onClick={handleSignIn}>
              Sign in
            </Button>
          )}
        </div>
      )}
    </header>
  )
}

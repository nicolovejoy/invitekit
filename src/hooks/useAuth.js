'use client'

import { useState, useEffect } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState(undefined)
  const [isOrganizer, setIsOrganizer] = useState(false)

  useEffect(() => {
    return onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult()
        setIsOrganizer(!!tokenResult.claims['freevite:organizer'])
      } else {
        setIsOrganizer(false)
      }
    })
  }, [])

  return { user, isOrganizer, loading: user === undefined }
}

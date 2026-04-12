'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

export default function OrganizerRoute({ children }) {
  const { user, isOrganizer, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !isOrganizer)) {
      router.replace('/')
    }
  }, [user, isOrganizer, loading, router])

  if (loading || !user || !isOrganizer) return null
  return children
}

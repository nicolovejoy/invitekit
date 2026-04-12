'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatDate, formatTime } from '@/lib/constants'
import OrganizerRoute from '@/components/OrganizerRoute'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

function DashboardContent() {
  const [events, setEvents] = useState([])
  const [invites, setInvites] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const eventsQ = query(collection(db, 'events'), orderBy('date', 'desc'))
    const invitesQ = query(collection(db, 'invites'))
    const unsubEvents = onSnapshot(eventsQ,
      snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => setError(err.message)
    )
    const unsubInvites = onSnapshot(invitesQ,
      snap => setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => setError(err.message)
    )
    return () => { unsubEvents(); unsubInvites() }
  }, [])

  function countsFor(eventId) {
    const evInvites = invites.filter(i => i.eventId === eventId)
    return {
      attending: evInvites.filter(i => i.rsvp === 'attending').reduce((s, i) => s + (i.guestCount ?? 1), 0),
      maybe: evInvites.filter(i => i.rsvp === 'maybe').reduce((s, i) => s + (i.guestCount ?? 1), 0),
      declined: evInvites.filter(i => i.rsvp === 'declined').length,
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {events.length === 0 ? (
        <p className="text-muted-foreground">
          No events yet. <Link href="/events/new" className="underline">Create one.</Link>
        </p>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const c = countsFor(event.id)
            const isPast = event.date < new Date().toLocaleDateString('en-CA')
            return (
              <Link key={event.id} href={`/events/${event.id}`} className="block">
                <Card className={isPast ? 'opacity-50' : undefined}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {event.title}
                          {isPast && ' (past)'}
                          {!isPast && event.status === 'draft' && (
                            <Badge variant="outline" className="ml-2 text-xs align-middle">Draft</Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{formatDate(event.date)} at {formatTime(event.time)}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Badge variant="default">{c.attending}</Badge>
                        <Badge variant="secondary">{c.maybe} maybe</Badge>
                        <Badge variant="outline">{c.declined} no</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default function DashboardPage() {
  return (
    <OrganizerRoute>
      <DashboardContent />
    </OrganizerRoute>
  )
}

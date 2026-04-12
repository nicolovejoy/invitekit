'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Copy, Check } from 'lucide-react'
import OrganizerRoute from '@/components/OrganizerRoute'
import { formatDate, formatTimeWithZone, magicLink } from '@/lib/constants'
import { buildInviteEmail, buildCustomEmail } from '@/lib/email-templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

function PreviewContent() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [invites, setInvites] = useState([])
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'events', eventId))
      .then(d => setEvent({ id: d.id, ...d.data() }))
      .catch(err => setError(err.message))

    const invitesQ = query(
      collection(db, 'invites'),
      where('eventId', '==', eventId),
      orderBy('createdAt')
    )
    const unsub = onSnapshot(invitesQ,
      snap => setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => setError(err.message)
    )
    return unsub
  }, [eventId])

  const counts = {
    attending: invites.filter(i => i.rsvp === 'attending').reduce((sum, i) => sum + (i.guestCount ?? 1), 0),
    maybe: invites.filter(i => i.rsvp === 'maybe').reduce((sum, i) => sum + (i.guestCount ?? 1), 0),
    declined: invites.filter(i => i.rsvp === 'declined').length,
    pending: invites.filter(i => !i.rsvp).length,
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error) return (
    <main className="max-w-2xl mx-auto p-4">
      <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
    </main>
  )
  if (!event) return null

  const sample = invites[0] || { name: 'Guest' }
  const link = magicLink('preview')
  const draft = event.draftEmail
  const previewHtml = draft
    ? buildCustomEmail({ invite: sample, body: draft.body, link })
    : buildInviteEmail({ invite: sample, event, link })

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.title}</h1>
          <p className="text-muted-foreground">{formatDate(event.date)} at {formatTimeWithZone(event.time, event.endTime, event.timezone)} — {event.location}</p>
          {event.description && <p className="mt-2">{event.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? <><Check className="size-4 mr-1" /> Copied</> : <><Copy className="size-4 mr-1" /> Copy link</>}
          </Button>
          <Button asChild size="sm">
            <Link href={`/events/${eventId}`}>Edit</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span>Attending: <strong>{counts.attending}</strong>{event.maxGuests ? ` / ${event.maxGuests}` : ''}</span>
        <span>Maybe: <strong>{counts.maybe}</strong></span>
        <span>Declined: <strong>{counts.declined}</strong></span>
        <span>Pending: <strong>{counts.pending}</strong></span>
      </div>

      {/* Email preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {draft ? `Draft email: ${draft.subject}` : 'Invitation email preview'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            srcDoc={previewHtml}
            sandbox=""
            className="w-full border rounded-md bg-white"
            style={{ height: 420 }}
            title="Email preview"
          />
        </CardContent>
      </Card>

      {/* Guest list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Guest list ({invites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {invites.map(invite => (
              <li key={invite.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{invite.name}</span>
                  <span className="text-muted-foreground text-sm"> ({invite.email})</span>
                </div>
                <Badge variant={
                  invite.rsvp === 'attending' ? 'default' :
                  invite.rsvp === 'maybe' ? 'secondary' : 'outline'
                }>
                  {invite.rsvp ?? 'no response'}
                  {invite.rsvp === 'attending' && invite.guestCount > 1 && ` ×${invite.guestCount}`}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}

export default function PreviewPage() {
  return (
    <OrganizerRoute>
      <PreviewContent />
    </OrganizerRoute>
  )
}

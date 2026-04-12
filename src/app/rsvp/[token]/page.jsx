'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  doc, getDoc, collection, query, where, orderBy,
  onSnapshot, addDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, linkWithPopup } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Check, CircleHelp, X, Send, Lock } from 'lucide-react'
import { formatDate, formatTimeWithZone } from '@/lib/constants'
import { cn } from '@/lib/utils'

function formatTimestamp(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return d.toLocaleDateString()
}

export default function RSVPPage() {
  const { token } = useParams()
  const [invite, setInvite] = useState(null)
  const [event, setEvent] = useState(null)
  const [messages, setMessages] = useState([])
  const [eventInvites, setEventInvites] = useState([])
  const [rsvp, setRsvp] = useState(null)
  const [guestCount, setGuestCount] = useState(1)
  const [newMessage, setNewMessage] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [error, setError] = useState(null)
  const [expired, setExpired] = useState(false)
  const [ready, setReady] = useState(false)
  const [hasResponded, setHasResponded] = useState(false)
  const [rsvpSaved, setRsvpSaved] = useState(false)
  const [linkingGoogle, setLinkingGoogle] = useState(false)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [googleError, setGoogleError] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    async function init() {
      const inviteSnap = await getDoc(doc(db, 'invites', token))
      if (!inviteSnap.exists()) {
        setError('This invite link is invalid or has expired.')
        return
      }
      const inviteData = { id: inviteSnap.id, ...inviteSnap.data() }
      setInvite(inviteData)
      setGuestCount(inviteData.guestCount ?? 1)
      setRsvp(inviteData.rsvp || null)
      if (inviteData.rsvp) setHasResponded(true)

      const eventSnap = await getDoc(doc(db, 'events', inviteData.eventId))
      const eventData = { id: eventSnap.id, ...eventSnap.data() }
      setEvent(eventData)

      const today = new Date().toLocaleDateString('en-CA')
      if (eventData.date < today) {
        setExpired(true)
        setReady(true)
        return
      }

      // Use existing auth if signed in (e.g. organizer), otherwise sign in anonymously
      let uid
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        uid = auth.currentUser.uid
      } else {
        const result = await signInAnonymously(auth)
        uid = result.user.uid
      }

      const claimRes = await fetch('/api/claim-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uid }),
      })
      if (!claimRes.ok && claimRes.status !== 409) {
        const body = await claimRes.json().catch(() => ({}))
        if (claimRes.status === 410) {
          setExpired(true)
          setReady(true)
          return
        }
        setError(body.error || 'Failed to claim invite')
        return
      }

      setReady(true)
    }

    init().catch(err => setError(err.message))
  }, [token])

  useEffect(() => {
    if (!invite) return
    const commentsQ = query(
      collection(db, 'comments'),
      where('eventId', '==', invite.eventId),
      where('isPublic', '==', true),
      orderBy('createdAt')
    )
    const invitesQ = query(
      collection(db, 'invites'),
      where('eventId', '==', invite.eventId),
      orderBy('createdAt')
    )
    const unsubComments = onSnapshot(commentsQ,
      snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Comments listener error:', err)
    )
    const unsubInvites = onSnapshot(invitesQ,
      snap => setEventInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('Invites listener error:', err)
    )
    return () => { unsubComments(); unsubInvites() }
  }, [invite])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function submitRSVP(status) {
    setRsvp(status)
    setHasResponded(true)
    await updateDoc(doc(db, 'invites', token), {
      rsvp: status,
      guestCount: status === 'declined' ? 0 : guestCount,
      rsvpUpdatedAt: serverTimestamp(),
    })
    setRsvpSaved(true)
    setTimeout(() => setRsvpSaved(false), 2000)
  }

  async function linkGoogle() {
    setLinkingGoogle(true)
    setGoogleError(null)
    try {
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider())
      setGoogleLinked(true)
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use') {
        setGoogleError('That Google account is already linked to another guest.')
      } else if (err.code === 'auth/popup-blocked') {
        setGoogleError('Popup was blocked — please allow popups and try again.')
      } else {
        setGoogleError(err.message)
      }
    } finally {
      setLinkingGoogle(false)
    }
  }

  async function saveGuestCount(count) {
    if (!ready || !rsvp) return
    await updateDoc(doc(db, 'invites', token), {
      guestCount: count,
      rsvpUpdatedAt: serverTimestamp(),
    })
  }

  async function postMessage(e) {
    e.preventDefault()
    if (!newMessage.trim()) return
    await addDoc(collection(db, 'comments'), {
      eventId: invite.eventId,
      inviteToken: token,
      uid: auth.currentUser.uid,
      authorName: invite.name,
      body: newMessage.trim(),
      isPublic,
      createdAt: serverTimestamp(),
    })
    setNewMessage('')
    setIsPublic(true)
  }

  const attendingCount = eventInvites.reduce((sum, i) => i.rsvp === 'attending' ? sum + (i.guestCount ?? 1) : sum, 0)
  const isFull = !!(event?.maxGuests && attendingCount >= event.maxGuests && invite?.rsvp !== 'attending')
  const myUid = auth.currentUser?.uid

  if (error) return (
    <main className="max-w-md mx-auto p-4 pt-12">
      <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
    </main>
  )
  if (!event || !invite) return (
    <main className="max-w-md mx-auto p-4 space-y-6">
      <div className="rounded-lg bg-muted animate-pulse w-full h-[300px]" />
      <div className="space-y-2">
        <div className="h-7 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="h-5 bg-muted animate-pulse rounded w-2/3" />
          <div className="flex gap-2">
            <div className="h-10 bg-muted animate-pulse rounded w-24" />
            <div className="h-10 bg-muted animate-pulse rounded w-20" />
            <div className="h-10 bg-muted animate-pulse rounded w-24" />
          </div>
        </CardContent>
      </Card>
    </main>
  )

  if (expired) return (
    <main className="max-w-md mx-auto p-4 pt-12 space-y-4">
      <h1 className="text-2xl font-semibold">{event.title}</h1>
      <p className="text-muted-foreground">{formatDate(event.date)} at {formatTimeWithZone(event.time, event.endTime, event.timezone)} — {event.location}</p>
      <Alert><AlertDescription>This event has ended. The RSVP window is now closed.</AlertDescription></Alert>
    </main>
  )

  return (
    <main className="relative max-w-md mx-auto p-4 space-y-6">
      <div className="fixed inset-0 -z-10">
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-muted-foreground">{formatDate(event.date)} at {formatTimeWithZone(event.time, event.endTime, event.timezone)}</p>
        <p className="text-muted-foreground">{event.location}</p>
        {event.description && <p className="mt-2">{event.description}</p>}
      </div>

      {/* RSVP section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {hasResponded ? 'Your Response' : 'Will you attend?'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasResponded && rsvp && (
            <div className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
              rsvp === 'attending' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
              rsvp === 'maybe' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
              rsvp === 'declined' && 'bg-muted text-muted-foreground',
            )}>
              {rsvp === 'attending' && <><Check className="h-4 w-4" /> You&apos;re attending!{guestCount > 1 && ` (${guestCount} guests)`}</>}
              {rsvp === 'maybe' && <><CircleHelp className="h-4 w-4" /> You responded Maybe</>}
              {rsvp === 'declined' && <><X className="h-4 w-4" /> You declined this invitation</>}
            </div>
          )}
          {!hasResponded && (
            <p className="text-muted-foreground">
              Hi {invite.name} — please let us know if you can make it.
            </p>
          )}
          {isFull && <Alert><AlertDescription>This event is full.</AlertDescription></Alert>}
          <div className="flex items-center gap-2">
            {['attending', 'maybe', 'declined'].map(status => (
              <Button
                key={status}
                size={hasResponded ? 'default' : 'lg'}
                variant={rsvp === status
                  ? (status === 'attending' ? 'default' : status === 'maybe' ? 'default' : 'secondary')
                  : 'outline'}
                className={cn(
                  rsvp === status && status === 'attending' && 'bg-green-600 hover:bg-green-700 text-white',
                  rsvp === status && status === 'maybe' && 'bg-amber-500 hover:bg-amber-600 text-white',
                )}
                onClick={() => submitRSVP(status)}
                disabled={!ready || (isFull && status === 'attending')}
                aria-pressed={rsvp === status}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
            {rsvpSaved && <span className="text-sm text-muted-foreground">Saved</span>}
          </div>
          {rsvp && rsvp !== 'declined' && (
            <div className="flex items-center gap-2">
              <Label htmlFor="guest-count">How many people?</Label>
              <Input
                id="guest-count"
                type="number"
                min="1"
                max="10"
                value={guestCount}
                onChange={e => setGuestCount(Number(e.target.value))}
                onBlur={e => saveGuestCount(Number(e.target.value))}
                className="w-20"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Who's coming */}
      {hasResponded && eventInvites.filter(i => i.rsvp === 'attending').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Who&apos;s coming ({eventInvites.filter(i => i.rsvp === 'attending').reduce((sum, i) => sum + (i.guestCount ?? 1), 0)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {eventInvites.filter(i => i.rsvp === 'attending').map(i => (
                <li key={i.id} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span>{i.name}{i.guestCount > 1 && ` +${i.guestCount - 1}`}</span>
                </li>
              ))}
              {eventInvites.filter(i => i.rsvp === 'maybe').map(i => (
                <li key={i.id} className="flex items-center gap-2 text-muted-foreground">
                  <CircleHelp className="h-3.5 w-3.5 shrink-0" />
                  <span>{i.name} (maybe)</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Guest chat */}
      <Card>
        <CardHeader>
          <CardTitle>Guest chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {messages.map(m => (
                <div
                  key={m.id}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm',
                    m.uid === myUid
                      ? 'bg-primary/10 ml-8'
                      : 'bg-muted mr-8',
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-xs">
                      {m.uid === myUid ? 'You' : m.authorName}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(m.createdAt)}</span>
                  </div>
                  <p>{m.body}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
          )}
          <form onSubmit={postMessage} className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder={isPublic ? 'Message everyone...' : 'Private note to host...'}
                disabled={!ready}
              />
            </div>
            <Button
              type="button"
              size="icon"
              variant={isPublic ? 'ghost' : 'secondary'}
              className="h-9 w-9 shrink-0"
              onClick={() => setIsPublic(!isPublic)}
              title={isPublic ? 'Public message' : 'Private — only the host will see this'}
            >
              <Lock className={cn('h-3.5 w-3.5', isPublic && 'text-muted-foreground')} />
            </Button>
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!ready || !newMessage.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
          {!isPublic && (
            <p className="text-xs text-muted-foreground">
              <Lock className="inline h-3 w-3 mr-0.5" /> Private — only the host will see this message.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Google sign-in upgrade — only for anonymous guests (not organizers) */}
      {ready && auth.currentUser?.isAnonymous && !googleLinked && (
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Want to save your account? Sign in with Google to keep access across devices.</p>
          <Button variant="ghost" size="sm" onClick={linkGoogle} disabled={linkingGoogle}>
            {linkingGoogle ? 'Connecting...' : 'Sign in with Google'}
          </Button>
          {googleError && <p className="text-destructive text-xs">{googleError}</p>}
        </div>
      )}
      {googleLinked && (
        <p className="text-center text-sm text-muted-foreground">Google account linked.</p>
      )}
    </main>
  )
}

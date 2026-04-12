'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  doc, setDoc, getDoc, deleteDoc, getDocs, updateDoc, collection, query, where, orderBy,
  onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { Copy, Check, X, Pencil, Send, Eye, Mail, Upload, Download } from 'lucide-react'
import OrganizerRoute from '@/components/OrganizerRoute'
import { buildInviteText, formatDate, formatTimeWithZone, magicLink } from '@/lib/constants'
import {
  buildInviteEmail, buildReminderEmail, buildNudgeEmail, buildThankYouEmail,
  buildCustomEmail, defaultDraftBody,
} from '@/lib/email-templates'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// Shared helper: send to a list of invites one at a time with progress
async function sendBulk({ targets, buildRequest, onProgress }) {
  const idToken = await auth.currentUser.getIdToken()
  let sent = 0
  let failed = 0
  onProgress({ sent: 0, total: targets.length })
  for (const invite of targets) {
    const { url, body } = buildRequest(invite)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      })
      if (res.ok) sent++
      else failed++
    } catch {
      failed++
    }
    onProgress({ sent: sent + failed, total: targets.length })
    if (sent + failed < targets.length) {
      await new Promise(r => setTimeout(r, 600))
    }
  }
  return { sent, failed }
}

function EventDetailContent() {
  const { eventId } = useParams()
  const router = useRouter()
  const [event, setEvent] = useState(null)
  const [invites, setInvites] = useState([])
  const [comments, setComments] = useState([])
  const [newGuest, setNewGuest] = useState({ name: '', email: '' })
  const [sending, setSending] = useState(null)
  const [sendError, setSendError] = useState({})
  const [error, setError] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [copyTarget, setCopyTarget] = useState(null)
  const [copied, setCopied] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editBody, setEditBody] = useState('')
  const [editNameTarget, setEditNameTarget] = useState(null)
  const [editNameValue, setEditNameValue] = useState('')

  // Bulk operation state (shared across all bulk sends)
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null) // { sent, total }
  const [bulkResult, setBulkResult] = useState(null) // { label, sent, failed }
  const [bulkError, setBulkError] = useState(null)

  // Send-all-invites dialog
  const [sendAllOpen, setSendAllOpen] = useState(false)

  // Thank-you dialog
  const [thankYouOpen, setThankYouOpen] = useState(false)
  const [thankYouAudiences, setThankYouAudiences] = useState({ attending: true, declined: false, maybe: false })

  // Email preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  // Compose email
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [composeAudience, setComposeAudience] = useState('all')
  const [draftSaved, setDraftSaved] = useState(false)

  // Import guests
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState(null)

  // Delete event
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const nameInputRef = useRef(null)

  useEffect(() => {
    getDoc(doc(db, 'events', eventId))
      .then(d => setEvent({ id: d.id, ...d.data() }))
      .catch(err => setError(err.message))

    const invitesQ = query(
      collection(db, 'invites'),
      where('eventId', '==', eventId),
      orderBy('createdAt')
    )
    const commentsQ = query(
      collection(db, 'comments'),
      where('eventId', '==', eventId),
      orderBy('createdAt')
    )

    const unsubInvites = onSnapshot(invitesQ,
      snap => setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => setError(err.message)
    )
    const unsubComments = onSnapshot(commentsQ,
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => setError(err.message)
    )

    return () => { unsubInvites(); unsubComments() }
  }, [eventId])

  async function addGuest(e) {
    e.preventDefault()
    const token = crypto.randomUUID()
    await setDoc(doc(db, 'invites', token), {
      token,
      eventId,
      email: newGuest.email,
      name: newGuest.name,
      uid: null,
      rsvp: null,
      createdAt: serverTimestamp(),
    })
    setNewGuest({ name: '', email: '' })
    setTimeout(() => nameInputRef.current?.focus(), 0)
  }

  async function confirmRemoveGuest() {
    if (!removeTarget) return
    await deleteDoc(doc(db, 'invites', removeTarget.id))
    setRemoveTarget(null)
  }

  async function confirmDeleteEvent() {
    setDeleting(true)
    try {
      const invitesSnap = await getDocs(query(collection(db, 'invites'), where('eventId', '==', eventId)))
      await Promise.all(invitesSnap.docs.map(d => deleteDoc(d.ref)))
      const commentsSnap = await getDocs(query(collection(db, 'comments'), where('eventId', '==', eventId)))
      await Promise.all(commentsSnap.docs.map(d => deleteDoc(d.ref)))
      await deleteDoc(doc(db, 'events', eventId))
      router.push('/dashboard')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  async function sendInvite(invite) {
    setSending(invite.id)
    setSendError(prev => { const n = { ...prev }; delete n[invite.id]; return n })
    try {
      const idToken = await auth.currentUser.getIdToken()
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token: invite.token, eventId }),
      })
      if (!res.ok) {
        let errMsg = 'Failed to send'
        try { const body = await res.json(); errMsg = body.error || errMsg } catch {}
        setSendError(prev => ({ ...prev, [invite.id]: errMsg }))
      }
    } catch (err) {
      setSendError(prev => ({ ...prev, [invite.id]: err.message }))
    }
    setSending(null)
  }

  async function sendAllInvites() {
    setBulkSending(true)
    setBulkError(null)
    setBulkResult(null)
    try {
      const result = await sendBulk({
        targets: invites,
        buildRequest: (invite) => ({
          url: '/api/send-invite',
          body: { token: invite.id, eventId },
        }),
        onProgress: setBulkProgress,
      })
      await updateDoc(doc(db, 'events', eventId), {
        status: 'sent',
        updatedAt: serverTimestamp(),
      })
      setEvent(prev => ({ ...prev, status: 'sent' }))
      setSendAllOpen(false)
      setBulkResult({ label: 'invitation', ...result })
    } catch (err) {
      setBulkError(err.message)
    }
    setBulkSending(false)
    setBulkProgress(null)
  }

  async function sendReminder() {
    const targets = invites.filter(i => i.rsvp === 'attending')
    if (targets.length === 0) return
    setBulkSending(true)
    setBulkError(null)
    setBulkResult(null)
    try {
      const result = await sendBulk({
        targets,
        buildRequest: (invite) => ({
          url: '/api/send-reminder',
          body: { eventId, token: invite.id },
        }),
        onProgress: setBulkProgress,
      })
      setBulkResult({ label: 'reminder', ...result })
    } catch (err) {
      setBulkError(err.message)
    }
    setBulkSending(false)
    setBulkProgress(null)
  }

  async function sendNudge() {
    const targets = invites.filter(i => !i.rsvp && i.emailSentAt)
    if (targets.length === 0) return
    setBulkSending(true)
    setBulkError(null)
    setBulkResult(null)
    try {
      const result = await sendBulk({
        targets,
        buildRequest: (invite) => ({
          url: '/api/send-nudge',
          body: { eventId, token: invite.id },
        }),
        onProgress: setBulkProgress,
      })
      setBulkResult({ label: 'nudge', ...result })
    } catch (err) {
      setBulkError(err.message)
    }
    setBulkSending(false)
    setBulkProgress(null)
  }

  async function sendThankYou() {
    const audiences = Object.entries(thankYouAudiences).filter(([, v]) => v).map(([k]) => k)
    const targets = invites.filter(i => audiences.includes(i.rsvp) && !i.thankYouSentAt)
    if (targets.length === 0) return
    setBulkSending(true)
    setBulkError(null)
    setBulkResult(null)
    try {
      const result = await sendBulk({
        targets,
        buildRequest: (invite) => ({
          url: '/api/send-thank-you',
          body: { eventId, token: invite.id },
        }),
        onProgress: setBulkProgress,
      })
      setThankYouOpen(false)
      setBulkResult({ label: 'thank-you', ...result })
    } catch (err) {
      setBulkError(err.message)
    }
    setBulkSending(false)
    setBulkProgress(null)
  }

  async function sendCustomEmail() {
    const targets = invites.filter(i => {
      if (composeAudience === 'all') return true
      if (composeAudience === 'pending') return !i.rsvp
      return i.rsvp === composeAudience
    })
    if (targets.length === 0) {
      setBulkError('No matching guests to send to')
      return
    }
    setBulkSending(true)
    setBulkError(null)
    setBulkResult(null)
    try {
      const result = await sendBulk({
        targets,
        buildRequest: (invite) => ({
          url: '/api/send-custom',
          body: { eventId, subject: composeSubject, body: composeBody, token: invite.id },
        }),
        onProgress: setBulkProgress,
      })
      setComposeOpen(false)
      setBulkResult({ label: 'email', ...result })
    } catch (err) {
      setBulkError(err.message)
    }
    setBulkSending(false)
    setBulkProgress(null)
  }

  async function saveCommentEdit() {
    if (!editTarget) return
    await updateDoc(doc(db, 'comments', editTarget.id), {
      body: editBody,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    })
    setEditTarget(null)
  }

  async function saveNameEdit() {
    if (!editNameTarget || !editNameValue.trim()) return
    await updateDoc(doc(db, 'invites', editNameTarget.id), {
      name: editNameValue.trim(),
    })
    setEditNameTarget(null)
  }

  function exportGuests() {
    const header = 'name,email,rsvp,guestCount'
    const rows = invites.map(i =>
      [i.name, i.email, i.rsvp || '', i.guestCount ?? 1]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '-')}-guests.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importGuests() {
    const lines = importText.trim().split('\n').filter(Boolean)
    // Skip header row if it looks like one
    const start = /^name[,\t]/i.test(lines[0]) ? 1 : 0
    let added = 0
    let skipped = 0
    const existingEmails = new Set(invites.map(i => i.email.toLowerCase()))
    for (let i = start; i < lines.length; i++) {
      // Support CSV (comma) and TSV (tab)
      const parts = lines[i].includes('\t')
        ? lines[i].split('\t').map(s => s.trim().replace(/^"|"$/g, ''))
        : lines[i].match(/(".*?"|[^,]+)/g)?.map(s => s.trim().replace(/^"|"$/g, '')) || []
      const name = parts[0]?.trim()
      const email = parts[1]?.trim()
      if (!name || !email || !email.includes('@')) { skipped++; continue }
      if (existingEmails.has(email.toLowerCase())) { skipped++; continue }
      existingEmails.add(email.toLowerCase())
      const token = crypto.randomUUID()
      await setDoc(doc(db, 'invites', token), {
        token,
        eventId,
        email,
        name,
        uid: null,
        rsvp: null,
        createdAt: serverTimestamp(),
      })
      added++
    }
    setImportResult({ added, skipped })
    setImportText('')
  }

  function showPreview(type) {
    const sample = invites[0] || { name: 'Guest' }
    const link = magicLink('preview')
    let html = ''
    if (type === 'invite') html = buildInviteEmail({ invite: sample, event, link })
    else if (type === 'reminder') html = buildReminderEmail({ invite: sample, event, link })
    else if (type === 'nudge') html = buildNudgeEmail({ invite: sample, event, link })
    else if (type === 'thankyou') html = buildThankYouEmail({ invite: sample, event, link, rsvpStatus: 'attending' })
    else if (type === 'custom') html = buildCustomEmail({ invite: sample, body: composeBody, link })
    setPreviewHtml(html)
    setPreviewOpen(true)
  }

  function openCompose() {
    if (!composeBody) {
      setComposeSubject(event.title)
      setComposeBody(event.draftEmail?.body || defaultDraftBody(event))
      if (event.draftEmail?.subject) setComposeSubject(event.draftEmail.subject)
      if (event.draftEmail?.audience) setComposeAudience(event.draftEmail.audience)
    }
    setComposeOpen(true)
  }

  async function saveDraft() {
    await updateDoc(doc(db, 'events', eventId), {
      draftEmail: {
        subject: composeSubject,
        body: composeBody,
        audience: composeAudience,
        savedAt: serverTimestamp(),
      },
    })
    setEvent(prev => ({ ...prev, draftEmail: { subject: composeSubject, body: composeBody, audience: composeAudience } }))
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }

  const counts = {
    attending: invites.filter(i => i.rsvp === 'attending').reduce((sum, i) => sum + (i.guestCount ?? 1), 0),
    maybe: invites.filter(i => i.rsvp === 'maybe').reduce((sum, i) => sum + (i.guestCount ?? 1), 0),
    declined: invites.filter(i => i.rsvp === 'declined').length,
    pending: invites.filter(i => !i.rsvp).length,
  }

  if (error) return (
    <main className="max-w-2xl mx-auto p-4">
      <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
    </main>
  )
  if (!event) return null

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-muted-foreground">{formatDate(event.date)} at {formatTimeWithZone(event.time, event.endTime, event.timezone)} — {event.location}</p>
        {event.description && <p className="mt-2">{event.description}</p>}
        <div className="flex items-center gap-4 mt-1">
          <Button asChild variant="link" className="px-0">
            <Link href={`/events/${eventId}/edit`}>Edit event</Link>
          </Button>
          <Button variant="link" className="px-0 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            Delete event
          </Button>
        </div>
      </div>

      {/* Draft status + send all */}
      {event.status === 'draft' && (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>This event is a <strong>draft</strong>. Invitations have not been sent yet.</span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => showPreview('invite')}>
                <Eye className="size-4 mr-1" /> Preview
              </Button>
              <Button size="sm" onClick={() => setSendAllOpen(true)} disabled={invites.length === 0 || bulkSending}>
                <Send className="size-4 mr-1.5" />
                Send all invitations
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Headcount */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Headcount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span>Attending: <strong>{counts.attending}</strong>{event.maxGuests ? ` / ${event.maxGuests}` : ''}</span>
            <span>Maybe: <strong>{counts.maybe}</strong></span>
            <span>Declined: <strong>{counts.declined}</strong></span>
            <span>Pending: <strong>{counts.pending}</strong></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {counts.attending > 0 && (
              <>
                <Button size="sm" onClick={sendReminder} disabled={bulkSending}>
                  Remind attending
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => showPreview('reminder')}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {counts.pending > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={sendNudge} disabled={bulkSending}>
                  Nudge non-responders
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => showPreview('nudge')}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {(counts.attending + counts.maybe + counts.declined) > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => setThankYouOpen(true)} disabled={bulkSending}>
                  Send thank-you
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => showPreview('thankyou')}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
          {/* Bulk progress / result / error */}
          {bulkProgress && (
            <p className="text-sm text-muted-foreground">Sending {bulkProgress.sent}/{bulkProgress.total}...</p>
          )}
          {bulkResult && (
            <p className="text-sm text-muted-foreground">
              {bulkResult.label === 'invitation' ? 'Invitation' :
               bulkResult.label === 'reminder' ? 'Reminder' :
               bulkResult.label === 'nudge' ? 'Nudge' :
               bulkResult.label === 'thank-you' ? 'Thank-you' :
               'Email'} sent to {bulkResult.sent} guest{bulkResult.sent !== 1 ? 's' : ''}.
              {bulkResult.failed > 0 && ` ${bulkResult.failed} failed.`}
            </p>
          )}
          {bulkError && (
            <Alert variant="destructive" role="alert"><AlertDescription>{bulkError}</AlertDescription></Alert>
          )}
          <div className="pt-1">
            <Button size="sm" variant="outline" onClick={openCompose} disabled={bulkSending}>
              <Mail className="size-4 mr-1.5" />
              {event.draftEmail ? 'Edit draft email' : 'Compose email'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Guest list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Guests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y">
            {invites.map(invite => (
              <li key={invite.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{invite.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditNameTarget(invite); setEditNameValue(invite.name) }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <span className="text-muted-foreground text-sm">({invite.email})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant={
                        invite.rsvp === 'attending' ? 'default' :
                        invite.rsvp === 'declined' ? 'outline' :
                        invite.rsvp === 'maybe' ? 'secondary' : 'outline'
                      }>
                        {invite.rsvp ?? 'no response'}
                        {invite.rsvp && invite.rsvp !== 'declined' && invite.guestCount > 1 && ` ×${invite.guestCount}`}
                      </Badge>
                      {invite.emailSentAt && (
                        <span className="text-xs text-muted-foreground">
                          Invited {invite.emailSentAt.toDate().toLocaleDateString()}
                        </span>
                      )}
                      {invite.reminderSentAt && (
                        <span className="text-xs text-muted-foreground">
                          Reminded {invite.reminderSentAt.toDate().toLocaleDateString()}
                        </span>
                      )}
                      {invite.nudgeSentAt && (
                        <span className="text-xs text-muted-foreground">
                          Nudged {invite.nudgeSentAt.toDate().toLocaleDateString()}
                        </span>
                      )}
                      {invite.thankYouSentAt && (
                        <span className="text-xs text-muted-foreground">
                          Thanked {invite.thankYouSentAt.toDate().toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {sendError[invite.id] && (
                      <p className="text-sm text-destructive mt-1" role="alert">{sendError[invite.id]}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => { setCopyTarget(invite); setCopied(false) }}
                    >
                      Copy invite
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendInvite(invite)}
                      disabled={sending === invite.id}
                    >
                      {sending === invite.id ? 'Sending...' : (invite.emailSentAt ? 'Resend' : 'Email')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoveTarget(invite)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={addGuest} className="flex gap-2 pt-2">
            <div className="flex-1">
              <Label htmlFor="guest-name" className="sr-only">Name</Label>
              <Input
                ref={nameInputRef}
                id="guest-name"
                placeholder="Name or Name <email>"
                value={newGuest.name}
                onChange={e => {
                  const val = e.target.value
                  const match = val.match(/^(.+?)\s*<([^>]+@[^>]+)>$/)
                  if (match) {
                    setNewGuest({ name: match[1].trim(), email: match[2].trim() })
                  } else {
                    setNewGuest(g => ({ ...g, name: val }))
                  }
                }}
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="guest-email" className="sr-only">Email</Label>
              <Input
                id="guest-email"
                placeholder="Email or Name <email>"
                value={newGuest.email}
                onChange={e => {
                  const val = e.target.value
                  const match = val.match(/^(.+?)\s*<([^>]+@[^>]+)>$/)
                  if (match) {
                    setNewGuest({ name: match[1].trim(), email: match[2].trim() })
                  } else {
                    setNewGuest(g => ({ ...g, email: val }))
                  }
                }}
                required
              />
            </div>
            <Button type="submit">Add</Button>
          </form>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setImportOpen(true); setImportResult(null) }}>
              <Upload className="size-3.5 mr-1" /> Import CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={exportGuests} disabled={invites.length === 0}>
              <Download className="size-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {comments.map(c => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium">{c.authorName}</span>
                    {!c.isPublic && <Badge variant="outline" className="ml-1.5 text-xs">private</Badge>}
                    <span className="text-muted-foreground">: {c.body}</span>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => { setEditTarget(c); setEditBody(c.body) }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteDoc(doc(db, 'comments', c.id))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Copy invite dialog */}
      <Dialog open={!!copyTarget} onOpenChange={open => { if (!open) setCopyTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy invitation</DialogTitle>
            <DialogDescription>
              Paste this into a text, email, or message to {copyTarget?.name}.
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-md max-h-60 overflow-y-auto">
            {copyTarget && event && buildInviteText({
              name: copyTarget.name,
              title: event.title,
              date: event.date,
              time: event.time,
              endTime: event.endTime,
              location: event.location,
              description: event.description,
              token: copyTarget.id,
            })}
          </pre>
          <DialogFooter>
            <Button
              onClick={async () => {
                const text = buildInviteText({
                  name: copyTarget.name,
                  title: event.title,
                  date: event.date,
                  time: event.time,
                  endTime: event.endTime,
                  location: event.location,
                  description: event.description,
                  token: copyTarget.id,
                })
                await navigator.clipboard.writeText(text)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <><Check className="size-4 mr-1.5" /> Copied</> : <><Copy className="size-4 mr-1.5" /> Copy to clipboard</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send all invitations dialog */}
      <Dialog open={sendAllOpen} onOpenChange={open => { if (!open && !bulkSending) { setSendAllOpen(false); setBulkError(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send all invitations</DialogTitle>
            <DialogDescription>
              Send email invitations to {invites.length} guest{invites.length !== 1 ? 's' : ''}? This will move the event out of draft.
            </DialogDescription>
          </DialogHeader>
          {bulkProgress && (
            <p className="text-sm text-muted-foreground">Sending {bulkProgress.sent}/{bulkProgress.total}...</p>
          )}
          {bulkError && (
            <Alert variant="destructive"><AlertDescription>{bulkError}</AlertDescription></Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendAllOpen(false)} disabled={bulkSending}>Cancel</Button>
            <Button onClick={sendAllInvites} disabled={bulkSending}>
              {bulkSending ? `Sending ${bulkProgress?.sent ?? 0}/${bulkProgress?.total ?? invites.length}...` : 'Send invitations'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit comment dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit comment</DialogTitle>
            <DialogDescription>
              Comment by {editTarget?.authorName}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveCommentEdit} disabled={!editBody.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit name dialog */}
      <Dialog open={!!editNameTarget} onOpenChange={open => { if (!open) setEditNameTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit guest name</DialogTitle>
            <DialogDescription>
              Update name for {editNameTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={editNameValue}
            onChange={e => setEditNameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveNameEdit() }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNameTarget(null)}>Cancel</Button>
            <Button onClick={saveNameEdit} disabled={!editNameValue.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thank-you dialog */}
      <Dialog open={thankYouOpen} onOpenChange={open => { if (!open && !bulkSending) { setThankYouOpen(false); setBulkError(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send thank-you emails</DialogTitle>
            <DialogDescription>Choose which guests to thank.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              ['attending', `Attending (${invites.filter(i => i.rsvp === 'attending').length})`],
              ['maybe', `Maybe (${invites.filter(i => i.rsvp === 'maybe').length})`],
              ['declined', `Declined (${invites.filter(i => i.rsvp === 'declined').length})`],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={thankYouAudiences[key]}
                  onChange={e => setThankYouAudiences(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="rounded border-input"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Guests who already received a thank-you will be skipped.</p>
          {bulkError && (
            <Alert variant="destructive"><AlertDescription>{bulkError}</AlertDescription></Alert>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => showPreview('thankyou')}>
              <Eye className="size-4 mr-1" /> Preview
            </Button>
            <Button variant="outline" onClick={() => setThankYouOpen(false)} disabled={bulkSending}>Cancel</Button>
            <Button
              onClick={sendThankYou}
              disabled={bulkSending || !Object.values(thankYouAudiences).some(Boolean)}
            >
              {bulkSending ? `Sending ${bulkProgress?.sent ?? 0}/${bulkProgress?.total ?? '?'}...` : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose email dialog */}
      <Dialog open={composeOpen} onOpenChange={open => { if (!open && !bulkSending) { setComposeOpen(false); setBulkError(null) } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Compose email</DialogTitle>
            <DialogDescription>
              Use {'{name}'} to personalize. Only guests who have been invited will receive this.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="compose-body">Message</Label>
              <Textarea
                id="compose-body"
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A personal RSVP link is automatically added below your message.
              </p>
            </div>
            <div>
              <Label htmlFor="compose-audience">Send to</Label>
              <select
                id="compose-audience"
                value={composeAudience}
                onChange={e => setComposeAudience(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="all">All invited guests</option>
                <option value="attending">Attending only</option>
                <option value="pending">Haven&apos;t responded</option>
                <option value="maybe">Maybe</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </div>
          {bulkError && (
            <Alert variant="destructive"><AlertDescription>{bulkError}</AlertDescription></Alert>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <div className="flex items-center gap-2 mr-auto">
              <Button variant="ghost" size="sm" onClick={() => showPreview('custom')}>
                <Eye className="size-4 mr-1" /> Preview
              </Button>
              <Button variant="ghost" size="sm" onClick={saveDraft}>
                {draftSaved ? 'Saved' : 'Save draft'}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setComposeOpen(false)} disabled={bulkSending}>Cancel</Button>
            <Button onClick={sendCustomEmail} disabled={bulkSending || !composeSubject.trim() || !composeBody.trim()}>
              {bulkSending
                ? `Sending ${bulkProgress?.sent ?? 0}/${bulkProgress?.total ?? '?'}...`
                : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>
              This is how the email will look. Names and links are placeholders.
            </DialogDescription>
          </DialogHeader>
          <iframe
            srcDoc={previewHtml}
            sandbox=""
            className="w-full border rounded-md bg-white"
            style={{ height: 420 }}
            title="Email preview"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove guest dialog */}
      <Dialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove guest</DialogTitle>
            <DialogDescription>
              Remove {removeTarget?.name} from the guest list? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmRemoveGuest}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete event dialog */}
      <Dialog open={deleteOpen} onOpenChange={open => !open && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{event?.title}</strong> and all its guests and comments? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteEvent} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import guests dialog */}
      <Dialog open={importOpen} onOpenChange={open => { if (!open) setImportOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import guests</DialogTitle>
            <DialogDescription>
              Paste CSV or tab-separated data. One guest per line: name, email. Duplicates are skipped.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={"Jane Doe, jane@example.com\nJohn Smith, john@example.com"}
            rows={6}
          />
          {importResult && (
            <p className="text-sm text-muted-foreground">
              Added {importResult.added} guest{importResult.added !== 1 ? 's' : ''}.
              {importResult.skipped > 0 && ` ${importResult.skipped} skipped (duplicate or invalid).`}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button onClick={importGuests} disabled={!importText.trim()}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default function EventDetailPage() {
  return (
    <OrganizerRoute>
      <EventDetailContent />
    </OrganizerRoute>
  )
}

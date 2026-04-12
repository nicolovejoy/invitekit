import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin'
import { SENDER_EMAIL, magicLink } from '@/lib/constants'
import { inviteSubject, buildInviteEmail, buildInvitePlainText } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const adminDb = getAdminDb()
  const adminAuth = getAdminAuth()

  const idToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded
  try {
    decoded = await adminAuth.verifyIdToken(idToken)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  if (!decoded['freevite:organizer']) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { token, eventId } = await request.json().catch(() => ({}))
  if (!token || !eventId) {
    return NextResponse.json({ error: 'Missing token or eventId' }, { status: 400 })
  }

  const [inviteSnap, eventSnap] = await Promise.all([
    adminDb.collection('invites').doc(token).get(),
    adminDb.collection('events').doc(eventId).get(),
  ])

  if (!inviteSnap.exists || !eventSnap.exists) {
    return NextResponse.json({ error: 'Invite or event not found' }, { status: 404 })
  }

  const invite = inviteSnap.data()
  const event = eventSnap.data()

  if (event.createdBy !== decoded.uid) {
    return NextResponse.json({ error: 'Not the event owner' }, { status: 403 })
  }
  const link = magicLink(token)

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: SENDER_EMAIL,
      to: invite.email,
      subject: inviteSubject(event),
      html: buildInviteEmail({ invite, event, link }),
      text: buildInvitePlainText({ invite, event, link }),
      headers: {
        'List-Unsubscribe': `<mailto:${SENDER_EMAIL.match(/<(.+)>/)?.[1] || 'invites@free-vite.com'}?subject=Unsubscribe>`,
      },
    }),
  })

  if (!emailRes.ok) {
    const body = await emailRes.text()
    return NextResponse.json({ error: body }, { status: 502 })
  }

  await adminDb.collection('invites').doc(token).update({
    emailSentAt: FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ ok: true })
}

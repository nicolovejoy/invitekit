import { NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request) {
  const adminDb = getAdminDb()

  // Derive the uid from a verified Firebase ID token (anonymous is fine) rather
  // than trusting the body — otherwise a caller with the invite URL could bind
  // it to an arbitrary uid and lock out the real guest.
  const idToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let uid
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { token } = await request.json().catch(() => ({}))

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 })
  }

  const inviteRef = adminDb.collection('invites').doc(token)
  const invite = await inviteRef.get()

  if (!invite.exists) {
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  }

  const inviteData = invite.data()

  // Check if already claimed by a different user
  if (inviteData.uid && inviteData.uid !== uid) {
    return NextResponse.json({ error: 'Invite already claimed' }, { status: 409 })
  }

  // Check if event has expired
  if (inviteData.eventId) {
    const eventSnap = await adminDb.collection('events').doc(inviteData.eventId).get()
    if (eventSnap.exists) {
      const eventDate = eventSnap.data().date
      const today = new Date().toLocaleDateString('en-CA')
      if (eventDate < today) {
        return NextResponse.json({ error: 'This event has ended.' }, { status: 410 })
      }
    }
  }

  await inviteRef.update({ uid })

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const ORGANIZER_EMAILS = (process.env.ORGANIZER_EMAILS || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean)

export async function POST(request) {
  const adminAuth = getAdminAuth()
  const idToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded
  try {
    decoded = await adminAuth.verifyIdToken(idToken)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { uid, email } = decoded
  const alreadyOrganizer = !!decoded['freevite:organizer']
  const emailAuthorized = ORGANIZER_EMAILS.includes(email)
  console.log('[organizer-claim]', { email, uid, alreadyOrganizer, emailAuthorized, allowedEmails: ORGANIZER_EMAILS })

  if (!alreadyOrganizer && !emailAuthorized) {
    return NextResponse.json({ error: 'Not authorized', email, allowedEmails: ORGANIZER_EMAILS }, { status: 403 })
  }

  await adminAuth.setCustomUserClaims(uid, { 'freevite:organizer': true })

  return NextResponse.json({ ok: true })
}

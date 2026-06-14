import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin'
import { ORGANIZER_CLAIM, magicLink } from '@/lib/constants'
import { sendEmail } from '@/lib/resend'
import {
  inviteSubject, buildInviteEmail, buildInvitePlainText,
  reminderSubject, buildReminderEmail, buildReminderPlainText,
  nudgeSubject, buildNudgeEmail, buildNudgePlainText,
  thankYouSubject, buildThankYouEmail, buildThankYouPlainText,
  buildCustomEmail, buildCustomPlainText,
} from '@/lib/email-templates'

// One entry per email type. `render` receives { invite, event, link, payload }
// (payload = parsed request body) and returns { subject, html, text }.
// `sentAtField` is the invite field stamped after a successful send;
// `requireFields` are extra body fields validated before sending;
// `skipUpdateIfSet` avoids overwriting an existing timestamp (custom emails).
export const EMAIL_TYPES = {
  invite: {
    sentAtField: 'emailSentAt',
    render: ({ invite, event, link }) => ({
      subject: inviteSubject(event),
      html: buildInviteEmail({ invite, event, link }),
      text: buildInvitePlainText({ invite, event, link }),
    }),
  },
  reminder: {
    sentAtField: 'reminderSentAt',
    render: ({ invite, event, link }) => ({
      subject: reminderSubject(event),
      html: buildReminderEmail({ invite, event, link }),
      text: buildReminderPlainText({ invite, event, link }),
    }),
  },
  nudge: {
    sentAtField: 'nudgeSentAt',
    render: ({ invite, event, link }) => ({
      subject: nudgeSubject(event),
      html: buildNudgeEmail({ invite, event, link }),
      text: buildNudgePlainText({ invite, event, link }),
    }),
  },
  'thank-you': {
    sentAtField: 'thankYouSentAt',
    render: ({ invite, event, link }) => ({
      subject: thankYouSubject(event),
      html: buildThankYouEmail({ invite, event, link, rsvpStatus: invite.rsvp }),
      text: buildThankYouPlainText({ invite, event, link, rsvpStatus: invite.rsvp }),
    }),
  },
  custom: {
    sentAtField: 'emailSentAt',
    skipUpdateIfSet: true,
    requireFields: ['subject', 'body'],
    render: ({ invite, link, payload }) => ({
      subject: payload.subject,
      html: buildCustomEmail({ invite, body: payload.body, link }),
      text: buildCustomPlainText({ invite, body: payload.body, link }),
    }),
  },
}

const json = (body, status) => NextResponse.json(body, { status })

/** Shared handler for all organizer-triggered "send one email to one invite" routes. */
export async function handleSend(request, typeName) {
  const type = EMAIL_TYPES[typeName]
  const adminDb = getAdminDb()
  const adminAuth = getAdminAuth()

  const idToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!idToken) return json({ error: 'Unauthorized' }, 401)

  let decoded
  try {
    decoded = await adminAuth.verifyIdToken(idToken)
  } catch {
    return json({ error: 'Invalid token' }, 401)
  }
  if (!decoded[ORGANIZER_CLAIM]) {
    return json({ error: 'Not authorized' }, 403)
  }

  const payload = await request.json().catch(() => ({}))
  const { token, eventId } = payload
  if (!token || !eventId) {
    return json({ error: 'Missing token or eventId' }, 400)
  }
  for (const field of type.requireFields ?? []) {
    if (!payload[field]) return json({ error: `Missing ${field}` }, 400)
  }

  const [inviteSnap, eventSnap] = await Promise.all([
    adminDb.collection('invites').doc(token).get(),
    adminDb.collection('events').doc(eventId).get(),
  ])
  if (!inviteSnap.exists || !eventSnap.exists) {
    return json({ error: 'Invite or event not found' }, 404)
  }
  const invite = inviteSnap.data()
  const event = eventSnap.data()
  if (event.createdBy !== decoded.uid) {
    return json({ error: 'Not the event owner' }, 403)
  }

  const link = magicLink(token)
  const { subject, html, text } = type.render({ invite, event, link, payload })

  const emailRes = await sendEmail({ to: invite.email, subject, html, text })
  if (!emailRes.ok) {
    const errBody = await emailRes.text()
    return json({ error: errBody }, 502)
  }

  if (!(type.skipUpdateIfSet && invite[type.sentAtField])) {
    await adminDb.collection('invites').doc(token).update({
      [type.sentAtField]: FieldValue.serverTimestamp(),
    })
  }

  return json({ ok: true })
}

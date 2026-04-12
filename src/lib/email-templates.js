import { escapeHtml, formatDate, formatTimeWithZone, magicLink } from '@/lib/constants'

// --- Invitation ---

export function inviteSubject(event) {
  return `You're invited: ${event.title}`
}

export function buildInviteEmail({ invite, event, link }) {
  const name = escapeHtml(invite.name)
  const title = escapeHtml(event.title)
  const location = escapeHtml(event.location)
  const description = event.description ? `<p style="margin:0 0 16px">${escapeHtml(event.description)}</p>` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 16px">Hi ${name},</p>
  <p style="margin:0 0 16px">You're invited to <strong>${title}</strong>.</p>
  <p style="margin:0 0 16px">${escapeHtml(formatDate(event.date))} at ${escapeHtml(formatTimeWithZone(event.time, event.endTime, event.timezone))}<br>${location}</p>
  ${description}
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500">RSVP here</a>
  </p>
  <p style="margin:0 0 8px">Your link stays active until the event — feel free to change your response at any time.</p>
  <p style="color:#999;font-size:12px;margin:0">This link is unique to you. Please don't forward it.</p>
</body></html>`
}

export function buildInvitePlainText({ invite, event, link }) {
  const lines = [
    `Hi ${invite.name},`,
    '',
    `You're invited to ${event.title}.`,
    '',
    `${formatDate(event.date)} at ${formatTimeWithZone(event.time, event.endTime, event.timezone)}`,
    event.location,
  ]
  if (event.description) lines.push('', event.description)
  lines.push('', `RSVP here: ${link}`, '', 'Your link stays active until the event — feel free to change your response at any time.')
  return lines.join('\n')
}

// --- Reminder (attending guests) ---

export function reminderSubject(event) {
  return `Reminder: ${event.title}`
}

export function buildReminderEmail({ invite, event, link }) {
  const name = escapeHtml(invite.name)
  const title = escapeHtml(event.title)
  const location = escapeHtml(event.location)
  const description = event.description ? `<p style="margin:0 0 16px">${escapeHtml(event.description)}</p>` : ''
  const guestLine = invite.guestCount > 1 ? ` (×${invite.guestCount})` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 16px">Hi ${name},</p>
  <p style="margin:0 0 16px">Just a reminder — you're attending <strong>${title}</strong>${guestLine}.</p>
  <p style="margin:0 0 16px">${escapeHtml(formatDate(event.date))} at ${escapeHtml(formatTimeWithZone(event.time, event.endTime, event.timezone))}<br>${location}</p>
  ${description}
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500">View your invite</a>
  </p>
  <p style="color:#999;font-size:12px;margin:0">This link is unique to you. Please don't forward it.</p>
</body></html>`
}

export function buildReminderPlainText({ invite, event, link }) {
  const guestLine = invite.guestCount > 1 ? ` (×${invite.guestCount})` : ''
  const lines = [
    `Hi ${invite.name},`,
    '',
    `Just a reminder — you're attending ${event.title}${guestLine}.`,
    '',
    `${formatDate(event.date)} at ${formatTimeWithZone(event.time, event.endTime, event.timezone)}`,
    event.location,
  ]
  if (event.description) lines.push('', event.description)
  lines.push('', `View your invite / change your response: ${link}`)
  return lines.join('\n')
}

// --- Non-responder nudge ---

export function nudgeSubject(event) {
  return `Reminder: You're invited to ${event.title}`
}

export function buildNudgeEmail({ invite, event, link }) {
  const name = escapeHtml(invite.name)
  const title = escapeHtml(event.title)
  const location = escapeHtml(event.location)
  const description = event.description ? `<p style="margin:0 0 16px">${escapeHtml(event.description)}</p>` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 16px">Hi ${name},</p>
  <p style="margin:0 0 16px">We haven't heard from you yet — you're invited to <strong>${title}</strong>.</p>
  <p style="margin:0 0 16px">${escapeHtml(formatDate(event.date))} at ${escapeHtml(formatTimeWithZone(event.time, event.endTime, event.timezone))}<br>${location}</p>
  ${description}
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500">RSVP here</a>
  </p>
  <p style="margin:0 0 8px">Let us know either way — it helps us plan.</p>
  <p style="color:#999;font-size:12px;margin:0">This link is unique to you. Please don't forward it.</p>
</body></html>`
}

export function buildNudgePlainText({ invite, event, link }) {
  const lines = [
    `Hi ${invite.name},`,
    '',
    `We haven't heard from you yet — you're invited to ${event.title}.`,
    '',
    `${formatDate(event.date)} at ${formatTimeWithZone(event.time, event.endTime, event.timezone)}`,
    event.location,
  ]
  if (event.description) lines.push('', event.description)
  lines.push('', `RSVP here: ${link}`, '', 'Let us know either way — it helps us plan.')
  return lines.join('\n')
}

// --- Thank-you ---

const thankYouMessages = {
  attending: { line: 'Thanks for confirming — looking forward to seeing you!', cta: 'View your invite' },
  maybe: { line: 'Thanks for your response. We hope you can make it!', cta: 'View your invite' },
  declined: { line: 'Thanks for letting us know. We\'ll miss you!', cta: 'View event details' },
}

export function thankYouSubject(event) {
  return `Thank you — ${event.title}`
}

export function buildThankYouEmail({ invite, event, link, rsvpStatus }) {
  const name = escapeHtml(invite.name)
  const title = escapeHtml(event.title)
  const msg = thankYouMessages[rsvpStatus] || thankYouMessages.attending

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 16px">Hi ${name},</p>
  <p style="margin:0 0 16px">${msg.line}</p>
  <p style="margin:0 0 16px"><strong>${escapeHtml(event.title)}</strong><br>${escapeHtml(formatDate(event.date))} at ${escapeHtml(formatTimeWithZone(event.time, event.endTime, event.timezone))}</p>
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500">${msg.cta}</a>
  </p>
  <p style="color:#999;font-size:12px;margin:0">This link is unique to you. Please don't forward it.</p>
</body></html>`
}

export function buildThankYouPlainText({ invite, event, link, rsvpStatus }) {
  const msg = thankYouMessages[rsvpStatus] || thankYouMessages.attending
  const lines = [
    `Hi ${invite.name},`,
    '',
    msg.line,
    '',
    event.title,
    `${formatDate(event.date)} at ${formatTimeWithZone(event.time, event.endTime, event.timezone)}`,
    '',
    `${msg.cta}: ${link}`,
  ]
  return lines.join('\n')
}

// --- Custom (organizer-composed) ---

export function buildCustomEmail({ invite, body, link }) {
  const personalized = body.replace(/\{name\}/g, invite.name)
  const htmlBody = escapeHtml(personalized)
    .replace(/\n\n/g, '</p><p style="margin:0 0 16px">')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 16px">${htmlBody}</p>
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:500">View your invite</a>
  </p>
  <p style="color:#999;font-size:12px;margin:0">This link is unique to you. Please don't forward it.</p>
</body></html>`
}

export function buildCustomPlainText({ invite, body, link }) {
  const personalized = body.replace(/\{name\}/g, invite.name)
  return personalized + '\n\nView your invite: ' + link
}

export function defaultDraftBody(event) {
  return `Hi {name},

A quick note about ${event.title} on ${formatDate(event.date)} at ${formatTimeWithZone(event.time, event.endTime, event.timezone)}.

[Your message here]

Looking forward to it!`
}

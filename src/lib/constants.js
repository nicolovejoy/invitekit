export const APP_URL = process.env.APP_URL || 'https://free-vite.com'
export const SENDER_EMAIL = process.env.SENDER_EMAIL || 'Freevite <rsvp@free-vite.com>'

export const US_TIMEZONES = [
  { label: 'Eastern Time (ET)',   value: 'America/New_York' },
  { label: 'Central Time (CT)',   value: 'America/Chicago' },
  { label: 'Mountain Time (MT)',  value: 'America/Denver' },
  { label: 'Arizona (MT, no DST)', value: 'America/Phoenix' },
  { label: 'Pacific Time (PT)',   value: 'America/Los_Angeles' },
  { label: 'Alaska Time (AKT)',   value: 'America/Anchorage' },
  { label: 'Hawaii Time (HT)',    value: 'America/Honolulu' },
]

/** "America/New_York" → "ET" (current abbreviation, DST-aware) */
export function formatTimezone(ianaTimezone) {
  if (!ianaTimezone) return ''
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: ianaTimezone, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

export function magicLink(token) {
  return `${APP_URL}/rsvp/${token}`
}

/** "2026-03-15" → "Saturday, March 15" */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/** "18:00" → "6:00 PM" */
export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

/** "18:00", "21:00" → "6:00 PM – 9:00 PM" */
export function formatTimeRange(startTime, endTime) {
  if (!endTime) return formatTime(startTime)
  return `${formatTime(startTime)} – ${formatTime(endTime)}`
}

/** "18:00", "21:00", "America/New_York" → "6:00 PM – 9:00 PM ET" */
export function formatTimeWithZone(startTime, endTime, timezone) {
  const time = formatTimeRange(startTime, endTime)
  if (!timezone) return time
  const tz = formatTimezone(timezone)
  return tz ? `${time} ${tz}` : time
}

export function buildInviteText({ name, title, date, time, endTime, timezone, location, description, token }) {
  const link = magicLink(token)
  const lines = [
    `Hi ${name},`,
    '',
    `You're invited to ${title}!`,
    '',
    `${formatDate(date)} at ${formatTimeWithZone(time, endTime, timezone)}`,
    location,
  ]
  if (description) {
    lines.push('', description)
  }
  lines.push('', `RSVP here: ${link}`, '', 'You can change your response anytime before the event.')
  return lines.join('\n')
}

export function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

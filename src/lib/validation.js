/** Validate an event's end time against its start time.
 *  Returns an error string, or null if valid (or if either time is absent). */
export function validateEndTime(startTime, endTime) {
  if (!endTime || !startTime) return null
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  if (endMins <= startMins) return 'End time must be after start time'
  const diff = endMins - startMins
  if (diff > 12 * 60) return 'End time must be within 12 hours of start time'
  return null
}

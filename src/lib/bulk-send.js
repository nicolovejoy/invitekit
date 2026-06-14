import { auth } from '@/lib/firebase'

// Send to a list of invites one at a time with progress, pausing briefly between
// sends to stay under Resend's rate limit. Returns { sent, failed }.
export async function sendBulk({ targets, buildRequest, onProgress }) {
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

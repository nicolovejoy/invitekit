import { SENDER_EMAIL, senderAddress } from '@/lib/constants'

/** POST a single email to Resend. Returns the raw fetch Response (caller checks `.ok`). */
export function sendEmail({ to, subject, html, text }) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: SENDER_EMAIL,
      to,
      subject,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<mailto:${senderAddress()}?subject=Unsubscribe>`,
      },
    }),
  })
}

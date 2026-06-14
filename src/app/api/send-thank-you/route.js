import { handleSend } from '@/lib/email-send'

export const dynamic = 'force-dynamic'

export const POST = (request) => handleSend(request, 'thank-you')

import { useState } from 'react'
import { sendBulk } from '@/lib/bulk-send'

/** Shared state + runner for the organizer's bulk email actions.
 *  `runBulk` sends to every target with progress, then stamps a labelled
 *  result; `onSuccess(result)` runs after a successful send (e.g. close a
 *  dialog or flip event status) and its throw surfaces as bulkError. */
export function useBulkSend() {
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null) // { sent, total }
  const [bulkResult, setBulkResult] = useState(null) // { label, sent, failed }
  const [bulkError, setBulkError] = useState(null)

  async function runBulk({ targets, buildRequest, label, onSuccess }) {
    setBulkSending(true)
    setBulkError(null)
    setBulkResult(null)
    try {
      const result = await sendBulk({ targets, buildRequest, onProgress: setBulkProgress })
      await onSuccess?.(result)
      setBulkResult({ label, ...result })
    } catch (err) {
      setBulkError(err.message)
    }
    setBulkSending(false)
    setBulkProgress(null)
  }

  return { bulkSending, bulkProgress, bulkResult, bulkError, setBulkError, runBulk }
}

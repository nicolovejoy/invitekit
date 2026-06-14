import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

export function getServiceAccount() {
  // FIREBASE_SERVICE_ACCOUNT_B64 (base64 of the JSON) is preferred for local dev:
  // `vercel env pull` rewrites the plain var's `\n` escapes as real newlines,
  // which makes JSON.parse choke. Base64 is a single token dotenv can't mangle.
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64
  const raw = b64
    ? Buffer.from(b64, 'base64').toString('utf8')
    : process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT (stringified JSON) or FIREBASE_SERVICE_ACCOUNT_B64 (its base64).')
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Service account JSON is invalid. For local dev, set FIREBASE_SERVICE_ACCOUNT_B64 to the base64 of the JSON (avoids .env newline mangling).')
  }
}

function getApp() {
  if (getApps().length) return getApps()[0]
  return initializeApp({
    credential: cert(getServiceAccount()),
  })
}

export function getAdminDb() {
  getApp()
  return getFirestore()
}

export function getAdminAuth() {
  getApp()
  return getAuth()
}

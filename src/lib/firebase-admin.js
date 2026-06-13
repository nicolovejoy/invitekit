import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not set. Add the stringified service account JSON to your environment.')
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the full service account JSON as a single stringified value.')
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

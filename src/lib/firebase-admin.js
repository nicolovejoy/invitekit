import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

function getApp() {
  if (getApps().length) return getApps()[0]
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
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

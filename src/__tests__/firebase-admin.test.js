import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getServiceAccount } from '@/lib/firebase-admin'

const SAMPLE = { type: 'service_account', project_id: 'free-vite', private_key: '-----BEGIN-----\nabc\n-----END-----\n' }

describe('getServiceAccount', () => {
  beforeEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT
    delete process.env.FIREBASE_SERVICE_ACCOUNT_B64
  })
  afterEach(() => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT
    delete process.env.FIREBASE_SERVICE_ACCOUNT_B64
  })

  it('parses the plain stringified JSON var', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(SAMPLE)
    expect(getServiceAccount()).toEqual(SAMPLE)
  })

  it('decodes the base64 var and prefers it over the plain var', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = 'not json'
    process.env.FIREBASE_SERVICE_ACCOUNT_B64 = Buffer.from(JSON.stringify(SAMPLE)).toString('base64')
    expect(getServiceAccount()).toEqual(SAMPLE)
  })

  it('throws a clear error when neither var is set', () => {
    expect(() => getServiceAccount()).toThrow(/FIREBASE_SERVICE_ACCOUNT/)
  })

  it('throws a clear error when the JSON is invalid', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = '{ not valid'
    expect(() => getServiceAccount()).toThrow(/invalid/i)
  })
})

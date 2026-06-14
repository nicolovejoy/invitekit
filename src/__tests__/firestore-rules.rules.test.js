import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'

// Exercises firestore.rules — the actual security boundary — against the emulator.
// Run with `npm run test:rules` (boots the emulator via firebase emulators:exec).

const ORGANIZER = { 'freevite:organizer': true }

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-invitekit',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

// --- Context helpers ---

const org = (uid = 'org-1') => testEnv.authenticatedContext(uid, ORGANIZER).firestore()
const guest = (uid = 'guest-1') => testEnv.authenticatedContext(uid).firestore()
const anon = () => testEnv.unauthenticatedContext().firestore()

/** Seed docs with rules bypassed, for arrange steps. */
async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore())
  })
}

const EVENT = { title: 'Loft Dinner', date: '2099-05-10', createdBy: 'org-1' }

// --- Events ---

describe('events', () => {
  beforeEach(() => seed(db => setDoc(doc(db, 'events', 'e1'), EVENT)))

  it('are readable by anyone, including the unauthenticated public', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'events', 'e1')))
  })

  it('cannot be created by the public', async () => {
    await assertFails(setDoc(doc(anon(), 'events', 'e2'), EVENT))
  })

  it('cannot be created by a non-organizer', async () => {
    await assertFails(setDoc(doc(guest(), 'events', 'e2'), { ...EVENT, createdBy: 'guest-1' }))
  })

  it('can be created by an organizer who owns the createdBy field', async () => {
    await assertSucceeds(setDoc(doc(org(), 'events', 'e2'), { ...EVENT, createdBy: 'org-1' }))
  })

  it('cannot be created with someone else as createdBy', async () => {
    await assertFails(setDoc(doc(org(), 'events', 'e2'), { ...EVENT, createdBy: 'other' }))
  })

  it('can only be updated/deleted by the creating organizer', async () => {
    await assertSucceeds(updateDoc(doc(org('org-1'), 'events', 'e1'), { title: 'Renamed' }))
    await assertFails(updateDoc(doc(org('org-2'), 'events', 'e1'), { title: 'Hijack' }))
    await assertFails(deleteDoc(doc(org('org-2'), 'events', 'e1')))
    await assertSucceeds(deleteDoc(doc(org('org-1'), 'events', 'e1')))
  })
})

// --- Invites ---

describe('invites', () => {
  const INVITE = {
    eventId: 'e1', email: 'a@x.com', name: 'Ann',
    eventCreatedBy: 'org-1', uid: null, rsvp: null,
  }
  beforeEach(() => seed(async db => {
    await setDoc(doc(db, 'events', 'e1'), EVENT)
    await setDoc(doc(db, 'invites', 'i1'), INVITE)
  }))

  it('are readable by anyone (the UUID is the secret)', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'invites', 'i1')))
  })

  it('can be created by the owning organizer, not a guest', async () => {
    await assertSucceeds(setDoc(doc(org(), 'invites', 'i2'), { ...INVITE }))
    await assertFails(setDoc(doc(guest(), 'invites', 'i3'), { ...INVITE }))
  })

  it('cannot be created with a mismatched eventCreatedBy', async () => {
    await assertFails(setDoc(doc(org(), 'invites', 'i2'), { ...INVITE, eventCreatedBy: 'other' }))
  })

  it('let the claimed owner update only RSVP fields', async () => {
    await seed(db => setDoc(doc(db, 'invites', 'i1'), { ...INVITE, uid: 'guest-1' }))
    await assertSucceeds(updateDoc(doc(guest('guest-1'), 'invites', 'i1'), {
      rsvp: 'attending', guestCount: 2, rsvpUpdatedAt: 'now',
    }))
    // Same owner, but touching a non-RSVP field → denied
    await assertFails(updateDoc(doc(guest('guest-1'), 'invites', 'i1'), { email: 'evil@x.com' }))
  })

  it('reject RSVP updates from a non-owner guest', async () => {
    await seed(db => setDoc(doc(db, 'invites', 'i1'), { ...INVITE, uid: 'guest-1' }))
    await assertFails(updateDoc(doc(guest('intruder'), 'invites', 'i1'), { rsvp: 'attending' }))
  })

  it('let the event-owner organizer update any field', async () => {
    await assertSucceeds(updateDoc(doc(org('org-1'), 'invites', 'i1'), { email: 'fixed@x.com' }))
  })

  it('can only be deleted by the event owner', async () => {
    await assertFails(deleteDoc(doc(guest(), 'invites', 'i1')))
    await assertSucceeds(deleteDoc(doc(org('org-1'), 'invites', 'i1')))
  })
})

// --- Comments ---

describe('comments', () => {
  const PUBLIC = { eventId: 'e1', uid: 'guest-1', authorName: 'Ann', body: 'hi', isPublic: true }
  const PRIVATE = { ...PUBLIC, uid: 'guest-1', body: 'psst', isPublic: false }
  beforeEach(() => seed(async db => {
    await setDoc(doc(db, 'events', 'e1'), EVENT)
    await setDoc(doc(db, 'comments', 'pub'), PUBLIC)
    await setDoc(doc(db, 'comments', 'priv'), PRIVATE)
  }))

  it('expose public comments to anyone but hide private ones from strangers', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'comments', 'pub')))
    await assertFails(getDoc(doc(guest('stranger'), 'comments', 'priv')))
  })

  it('let the author and the event-owner organizer read a private comment', async () => {
    await assertSucceeds(getDoc(doc(guest('guest-1'), 'comments', 'priv')))
    await assertSucceeds(getDoc(doc(org('org-1'), 'comments', 'priv')))
  })

  it('require a creator to stamp their own uid', async () => {
    await assertSucceeds(setDoc(doc(guest('guest-1'), 'comments', 'c2'), { ...PUBLIC, uid: 'guest-1' }))
    await assertFails(setDoc(doc(guest('guest-1'), 'comments', 'c3'), { ...PUBLIC, uid: 'someone-else' }))
    await assertFails(setDoc(doc(anon(), 'comments', 'c4'), { ...PUBLIC, uid: 'guest-1' }))
  })

  it('let the author edit only body/isPublic', async () => {
    await assertSucceeds(updateDoc(doc(guest('guest-1'), 'comments', 'pub'), { body: 'edited', isPublic: false }))
    await assertFails(updateDoc(doc(guest('guest-1'), 'comments', 'pub'), { authorName: 'Spoofed' }))
    await assertFails(updateDoc(doc(guest('stranger'), 'comments', 'pub'), { body: 'nope' }))
  })

  it('can only be deleted by the event-owner organizer', async () => {
    await assertFails(deleteDoc(doc(guest('guest-1'), 'comments', 'pub')))
    await assertSucceeds(deleteDoc(doc(org('org-1'), 'comments', 'pub')))
  })
})

// --- Waitlist ---

describe('waitlist', () => {
  it('accepts public creates but blocks all reads', async () => {
    await assertSucceeds(setDoc(doc(anon(), 'waitlist', 'w1'), { email: 'a@x.com' }))
    await seed(db => setDoc(doc(db, 'waitlist', 'w2'), { email: 'b@x.com' }))
    await assertFails(getDoc(doc(anon(), 'waitlist', 'w2')))
    await assertFails(getDoc(doc(org('org-1'), 'waitlist', 'w2')))
  })
})

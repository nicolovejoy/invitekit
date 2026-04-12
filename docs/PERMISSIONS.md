# Permissions & Access Control

How InviteKit handles users, authentication, and authorization — where we are today, where we're headed, and how to get there.

## Roles

Four roles, from most to least privileged:

- **Admin** — manages who can organize events _(Phase 3 — does not exist yet)_
- **Organizer** — creates events, invites guests, sends emails
- **Guest** — RSVPs, comments (anonymous Firebase auth, invisible to them)
- **Public** — views events and public comments, submits to waitlist

## Current State

### How it works today

The system has one real permission boundary: the `freevite:organizer` Firebase custom claim.

**Organizer sign-in:**
1. Google popup sign-in (`signInWithPopup`)
2. Client calls `POST /api/set-organizer-claim` with ID token
3. Server checks email against `ORGANIZER_EMAILS` env var
4. If approved, sets `freevite:organizer: true` custom claim
5. Client force-refreshes token; `useAuth()` picks up the claim

**Guest flow:**
1. Guest clicks magic link (`/rsvp/{uuid}`)
2. `signInAnonymously()` creates a temporary Firebase user
3. `POST /api/claim-invite` links their UID to the invite doc
4. Firestore rules allow them to update their own RSVP fields

**Public access:**
- Events and invites are world-readable (the UUID in the invite URL is the secret)
- Waitlist is write-only from the client

### What Firestore rules enforce

```
events:    read: anyone          write: isOrganizer()
invites:   read: anyone          create/delete: isOrganizer()
                                 update RSVP fields: owner (uid match)
comments:  read: public or author or organizer
           create: any authenticated user (uid must match)
           update body/isPublic: author    update anything: organizer
           delete: organizer
waitlist:  create: anyone        read/update/delete: nobody
```

### What's missing

- **No ownership enforcement.** Events store `createdBy` but rules don't check it. Any organizer can edit or delete any event.
- **No invite attribution.** Invites don't record who created them (`addedBy` is missing).
- **Dashboard is unscoped.** Queries all events, not just the current organizer's.
- **API routes trust the claim.** Email endpoints verify `isOrganizer()` but don't check that the event belongs to the caller.
- **Organizer gate is deploy-time.** Adding an organizer requires changing `ORGANIZER_EMAILS` and redeploying.

**Bottom line:** the system is effectively single-tenant. It works for one organizer (or a small trusted group), but any organizer can see, edit, and delete everything.

## Target State

A self-hosted InviteKit instance where:

- The first user who signs up becomes the admin (or is seeded via env var for headless deploys)
- Admins grant organizer access through the app, not deployment config
- Each organizer sees and manages only their own events
- Events can optionally have co-organizers (collaborator list)
- Firestore rules enforce all of this — client code is convenience, not security
- `ORGANIZER_EMAILS` is gone (or optional as a bootstrap mechanism)

### Target roles

| Role | How assigned | Can do |
|------|-------------|--------|
| **Admin** | First sign-up or `ADMIN_EMAIL` env var | Everything an organizer can do, plus: add/remove organizers, view all events |
| **Organizer** | Admin grants via UI | Create events, manage own events + events where listed as editor, invite guests, send emails |
| **Guest** | Clicks magic link | RSVP, set guest count, post comments on their event |
| **Public** | No auth | View events (if they know the URL), read public comments, submit to waitlist |

### Target data model

```
/users/{uid}
  email, displayName, role ('admin' | 'organizer'), createdAt

/events/{eventId}
  ..., createdBy, editors: [uid, ...], createdAt

/invites/{token}
  ..., addedBy, createdAt

/comments/{commentId}   (unchanged)
/waitlist/{docId}        (unchanged)
```

### Target Firestore rules (sketch)

```
function isAdmin() {
  return request.auth.token['freevite:admin'] == true;
}
function isOrganizer() {
  return request.auth.token['freevite:organizer'] == true || isAdmin();
}
function isEventOwner(eventId) {
  return request.auth.uid == get(/databases/$(database)/documents/events/$(eventId)).data.createdBy;
}
function isEventEditor(eventId) {
  return request.auth.uid in get(/databases/$(database)/documents/events/$(eventId)).data.editors;
}
function canManageEvent(eventId) {
  return isAdmin() || isEventOwner(eventId) || isEventEditor(eventId);
}

events:
  read: anyone
  create: isOrganizer() && createdBy == request.auth.uid
  update/delete: canManageEvent(eventId) || isAdmin()

invites:
  read: anyone
  create: canManageEvent(resource.data.eventId)
  update RSVP: owner (uid match)
  delete: canManageEvent(eventId)
```

## Migration Path

Three phases, each independently shippable.

### Phase 1 — Safe multi-organizer

_Addresses issues #15 and #20._

**Goal:** Multiple organizers, each scoped to their own data. No new roles, no new UI beyond autocomplete.

Changes:
- **Firestore rules:** events require `createdBy == request.auth.uid` for update/delete
- **Firestore rules:** invites — denormalize `eventCreatedBy` on invite docs so rules can check ownership in a single read
- **Invite creation:** add `addedBy: currentUser.uid` and `eventCreatedBy: event.createdBy` to new invite docs
- **Dashboard query:** add `where('createdBy', '==', currentUser.uid)` + Firestore composite index
- **API routes:** verify event ownership before sending emails (fetch event, check `createdBy`)
- **Autocomplete (issue #15):** query invites by `addedBy` for per-organizer suggestions; composite index on `(addedBy, createdAt desc)`

What doesn't change: `ORGANIZER_EMAILS` stays, no admin role yet, no collaborators.

### Phase 2 — Shared events

**Goal:** Co-organizers can collaborate on events.

Changes:
- **Events:** add `editors: []` array (empty by default)
- **Firestore rules:** allow write if `createdBy == uid || uid in resource.data.editors`
- **Event detail UI:** "Invite co-organizer" button, share by email
- **Dashboard:** query events where `createdBy == uid` OR `uid in editors` (may need two queries + merge on client)

### Phase 3 — Self-hoster friendly

_Addresses issues #18 and #19._

**Goal:** No deployment config needed to manage organizers.

Changes:
- **New collection:** `/users/{uid}` with `role` field
- **Admin claim:** `freevite:admin` custom claim, set on first sign-up or via `ADMIN_EMAIL` env var
- **Admin UI:** page to list organizers, grant/revoke access
- **Sign-up flow:** Google sign-in for anyone, admin approves organizer role
- **Remove `ORGANIZER_EMAILS`:** custom claims derived from `/users` collection via Cloud Function or API route
- **Migration guide:** existing installs get a one-time script to seed `/users` from current `ORGANIZER_EMAILS`
- **Self-hoster docs (issue #18):** document the new setup flow

## Open Questions

- **Backfill `addedBy`?** Probably not — new invites will seed the autocomplete naturally. Old invites without `addedBy` just won't appear in suggestions.
- **Denormalize `eventCreatedBy` on invites?** Yes for Phase 1 — Firestore rules can't do joins, so the invite doc needs to know who owns the event. Adds a consistency risk if event ownership transfers, but that's a Phase 2 concern.
- **Phase 3 bootstrap:** Support both `ADMIN_EMAIL` env var (for headless/CI deploys) and first-signup-is-admin (for interactive setup). Env var takes precedence if set.
- **Firestore `get()` calls in rules:** Phase 2+ rules use `get()` to read the event doc when evaluating invite writes. This counts as a Firestore read and adds latency. Acceptable for the security gain, but worth noting.

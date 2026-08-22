# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InviteKit is an open-source event invitation web app (small dinner parties, concerts, ~15–30 guests). Originally built as Freevite, now released publicly so others can self-host. Reference deployment at `https://free-vite.com`.

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, shadcn/ui (Tailwind v4 + Radix, `new-york` style, JSX not TSX)
- **Database:** Firestore (events, invites, comments)
- **Auth:** Firebase Auth — Google sign-in for organizers, anonymous auth for guests
- **Email:** Resend API via Next.js Route Handlers
- **Testing:** Vitest + React Testing Library + happy-dom
- **Node:** v20 (see `.nvmrc`)

## Commands

```bash
npm run dev          # Local dev server (turbopack)
npm run build        # Production build
npm run test         # Vitest (single run; excludes *.rules.test.js)
npm run test:watch   # Vitest (watch mode)
npm run test:rules   # Firestore rules tests (boots the emulator; needs JDK 21+)
npx vitest run src/__tests__/Header.test.jsx   # Run single test file
npm run lint         # Next.js lint
```

Deploy Firestore rules (separate from Vercel):

```bash
firebase deploy --only firestore
```

## Architecture

### Permissions Model

Three roles, two auth mechanisms. **Firestore rules are the security boundary, not client code.**

**Organizers** — real Google accounts. On sign-in, `POST /api/set-organizer-claim` checks `ORGANIZER_EMAILS` env var and sets `freevite:organizer` custom claim via Firebase Admin SDK. Client force-refreshes the ID token. Firestore rules check `request.auth.token['freevite:organizer'] == true`. Can: create/edit/delete events, manage guests, send emails, read all comments.

**Guests** — anonymous Firebase accounts, invisible to them. Created when they click their magic link. `POST /api/claim-invite` writes their anonymous UID to the invite doc. Firestore rules enforce ownership. Can: update own RSVP fields (`rsvp`, `guestCount`, `rsvpUpdatedAt`), create comments, edit own comments (`body`, `isPublic`). Anonymous accounts can upgrade to Google (same UID preserved).

**Public** — no auth. Can read events and invites (the UUID in the URL is the secret), submit to waitlist. Cannot write anything else.

### Firestore Rules Summary

- **Events:** anyone reads, only organizers write
- **Invites:** anyone reads (UUID is the secret), organizers create/delete, claimed owner updates RSVP fields only
- **Comments:** public ones readable by anyone, private by author/organizer. Authenticated users create (must match own UID). Author edits body/isPublic only.
- **Waitlist:** anyone creates, nobody reads/edits via client

### Magic Link Flow

1. Organizer adds guest → creates `/invites/{uuid}` with `uid: null`
2. Organizer sends invite → `POST /api/send-invite` emails a link: `APP_URL/rsvp/{uuid}`
3. Guest clicks link → `signInAnonymously()` → `POST /api/claim-invite { token, uid }`
4. Server sets `uid` on invite doc → guest can now RSVP and comment

### Firestore Collections

- `/events/{eventId}` — title, date, time, endTime (optional), location, description, maxGuests, createdBy, status (`draft`/`sent`), draftEmail (saved compose: subject/body/audience), createdAt, updatedAt
- `/invites/{token}` — document ID is the UUID (the magic link secret). Has token, eventId, email, name, uid (null until claimed), rsvp status, guestCount, rsvpUpdatedAt, addedBy (inviting organizer uid; #15 groundwork), eventCreatedBy (denormalized; required by rules create/update/delete + dashboard query), emailSentAt/reminderSentAt/nudgeSentAt/thankYouSentAt (send timestamps), createdAt
- `/comments/{commentId}` — eventId, inviteToken, uid, authorName, body, isPublic, createdAt, updatedAt/updatedBy (on edit)
- `/waitlist/{docId}` — email, name, howFound, comments, createdAt. Write-only via client (rules block reads)

### Key Patterns

- All pages are client components (`'use client'`) due to Firebase realtime listeners (`onSnapshot`)
- API routes use `export const dynamic = 'force-dynamic'` to prevent build-time pre-rendering
- API routes verify organizer claims server-side via `adminAuth.verifyIdToken()`
- Organizer sign-in uses `signInWithPopup` (not redirect) — popup works across origins, enabling preview deploys on `preview.free-vite.com`. Header handles the full flow: popup → set-organizer-claim → force-refresh token.
- `OrganizerRoute` is a client-side auth guard wrapping organizer-only pages
- `useAuth()` returns `{ user, isOrganizer, loading }` — `loading` is true while `user === undefined`. `useEvent(eventId)` subscribes to an event + its invites/comments; `useBulkSend()` owns shared bulk-email state + a `runBulk()` runner (see `src/hooks/`)
- Path alias: `@/` maps to `src/`
- Email templates are in `src/lib/email-templates.js` — five types: invite, reminder, nudge, thank-you, custom
- `src/lib/constants.js` has `APP_URL`, `SENDER_EMAIL`, `ORGANIZER_CLAIM`, `magicLink()`, `senderAddress()`, date/time formatters, `escapeHtml()`
- Server lib helpers: `lib/email-send.js` (`handleSend` + `EMAIL_TYPES` registry), `lib/resend.js` (`sendEmail`), `lib/bulk-send.js`, `lib/csv.js`, `lib/validation.js`

### Email API Routes

The five send routes are thin delegations to `handleSend(request, type)` in
`lib/email-send.js`; each type's templates + timestamp field live in the
`EMAIL_TYPES` registry there. Route handlers in `src/app/api/`:

- `send-invite` — initial invitation
- `send-reminder` — for confirmed attendees
- `send-nudge` — for non-responders
- `send-thank-you` — after RSVP
- `send-custom` — organizer-composed message
- `claim-invite` — links anonymous UID to invite (not email)
- `set-organizer-claim` — sets custom claim on sign-in

### Adding shadcn Components

```bash
npx shadcn@latest add [component-name]
```

Config is in `components.json` — JSX (not TSX), `new-york` style, CSS variables enabled.

## Environment Variables

See `.env.local.example`. Key vars:

- `NEXT_PUBLIC_FIREBASE_*` — client-side Firebase config (6 vars)
- `FIREBASE_SERVICE_ACCOUNT` — full service account JSON, stringified
- `ORGANIZER_EMAILS` — comma-separated approved organizer emails
- `RESEND_API_KEY` — for sending emails
- `APP_URL` — used to build magic links (fallback in constants.js)

## Firebase

Firebase project: `free-vite`. Auth rewrite proxy in `next.config.mjs` points `/__/auth/*` to Firebase Hosting for same-origin auth flow. Auth providers enabled: Google + Anonymous. Firestore rules deployed.

## Testing

Tests live in `src/__tests__/`. Setup file at `src/__tests__/setup.js` imports `@testing-library/jest-dom/vitest`. Firebase and Next.js modules are mocked in tests (see `Header.test.jsx` for patterns). When writing tests, mock `@/hooks/useAuth`, `@/lib/firebase`, `firebase/auth`, and `next/link`.

**Security-rules tests** (`*.rules.test.js`) run against the Firestore emulator via `npm run test:rules` (uses `@firebase/rules-unit-testing` + `vitest.rules.config.js`; needs JDK 21+). They're excluded from the default `npm test`. CI runs them in a separate `rules-test` job. Edit `firestore.rules` → add/adjust a case in `src/__tests__/firestore-rules.rules.test.js`.

## Git Workflow

**Start every session by pulling and checking what's in flight:**

```bash
git checkout main && git pull
gh pr list
gh issue list
```

**IMPORTANT: Never commit directly to `main`.** All work happens on feature branches. Push the branch and open a PR for the other person to review before merging. Use GitHub Issues for all bugs and tasks — keep tickets small and contained. This applies to both humans and Claude Code.

**Roles:** One contributor, more junior, focuses on UX thinking and user testing first, code via Claude Code second. The other reviews PRs and handles infra/ops (env vars, Vercel, Resend, Firebase).

## Deployment

The reference deployment runs on Vercel with auto-deploy on push to `main`. Custom domain `https://free-vite.com` via Cloudflare DNS (DNS only / no proxy), SSL auto-provisioned by Vercel. Self-hosters can deploy anywhere that runs Next.js; Vercel is the path of least resistance.

## Repo

This repo was originally the private `nicolovejoy/freevite`. It was relaunched as public `nicolovejoy/invitekit` with a fresh commit history and MIT license so others can fork and self-host.

**Product direction** (`docs/VISION.md`, 2026-06-14): open-core SaaS — hosted service is the business, open-source is the trust moat + funnel (not a self-host market). Paying user = recurring small-org hosts (clubs/classes/communities/bands), not one-off party-throwers. Keep the data model multi-tenant-ready; defer billing/signup infra until willingness-to-pay is validated. **Open question to settle before Permissions Phase 3:** is the recurring host the right paying user?

## Next Steps

1. **Merge PR #66** (`docs/vision` — VISION.md + Soirée-framed elevator-pitch PDF, shared with Manine for the product angle).
2. **#17 rate-limiting** — design settled. Provision Upstash (Marketplace + `UPSTASH_REDIS_REST_URL`/`_TOKEN`), then build `lib/rate-limit.js` (sliding-window, `x-real-ip` + token keys, **fail-open** when unconfigured). Prerequisite: move the waitlist write into `POST /api/waitlist` + lock the `waitlist` rule (client-side `addDoc` today → unlimitable). Limits: claim-invite 10/10min per IP + 5/hr per token; waitlist 5/hr per IP.
3. **Extract presentational subcomponents** from `events/[eventId]/page.jsx` (901 lines, mostly JSX): `GuestList`, `Headcount`, `ComposeDialog`, `ImportDialog`, `ThankYouDialog`, `CopyInviteDialog` — unblocks UI test coverage.
4. **Finish #19** broader white-label/copy surface. Brand name + claim now centralized (`BRAND`, `ORGANIZER_CLAIM`; #63); remaining is per-tenant config (ties into product direction). NOTE: add `NEXT_PUBLIC_BRAND_NAME` to `.env.local.example` (hook-blocked for Claude — human edit).
5. **Other open issues:** #13 all-day events (cheap via registry/formatters), #15 autofill past invitees (`addedBy` written; needs composite index + UI), #18 self-hoster SETUP.md, #12 RSVP UX audit.

**Permissions roadmap** (`docs/PERMISSIONS.md`): Phase 2 = shared events via co-organizer `editors` array; Phase 3 = admin role + self-service organizer mgmt, drop `ORGANIZER_EMAILS`. Phase 3 is the first work that only pays off under the SaaS direction — settle the paying-user question first.

**Done this session (2026-06-14):** brand config #19 (#63), schema-doc fixes (#64), claim-invite ID-token verification = "Option A" (#65), all 5 Dependabot bumps merged, #16 closed.

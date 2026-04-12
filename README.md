# InviteKit

Open-source event invitations with RSVP tracking. Organizer creates an event, adds guests by name and email, and sends each guest a unique magic link. Guests click the link, RSVP, and leave comments — no accounts needed.

Originally built as [Freevite](https://free-vite.com) for small dinner parties and concerts (~15–30 guests). Released as open source so others can host their own.

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # fill in Firebase and Resend values
npm run dev
```

See the Setup section below for how to create your own Firebase project and Resend account — this is the slowest part of self-hosting.

## Tech Stack

- Next.js 15 (App Router) + React 19
- Firebase Auth (Google sign-in for organizers, anonymous for guests)
- Firestore (events, invites, comments)
- Resend (transactional email)
- shadcn/ui (Tailwind v4 + Radix)
- Vitest + React Testing Library

## Environment Variables

Copy `.env.local.example` and fill in:

- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config (6 vars, not secret)
- `FIREBASE_SERVICE_ACCOUNT` — service account JSON (stringified)
- `ORGANIZER_EMAILS` — comma-separated approved organizer emails
- `RESEND_API_KEY` — Resend API key
- `APP_URL` — full app URL for magic links (e.g. `https://your-domain.com`)
- `SENDER_EMAIL` — email address invitations are sent from

## Scripts

```bash
npm run dev          # Dev server (turbopack)
npm run build        # Production build
npm run test         # Run tests
npm run test:watch   # Tests in watch mode
npm run lint         # Lint
```

## How It Works

Organizers sign in with Google. A server route checks their email against `ORGANIZER_EMAILS` and sets a custom Firebase Auth claim. Firestore rules enforce the organizer/guest/public permission model — client code cannot bypass them.

Organizers create events and add guests. Each guest gets a unique magic link (`/rsvp/{uuid}`). Clicking the link signs the guest in anonymously and lets them RSVP, change their response, and leave comments. No guest accounts needed, no passwords.

Three roles:

- **Public** — can read event and invite pages (the UUID in the URL is the secret)
- **Guests** — anonymous Firebase accounts, can update their own RSVP and comment
- **Organizers** — authenticated with Google, can create/edit/delete events and manage guest lists

## Self-Hosting

See [`docs/SETUP.md`](docs/SETUP.md) for step-by-step instructions on:

- Creating a Firebase project and enabling Google + Anonymous auth
- Deploying Firestore rules
- Creating a Resend account and verifying your sender domain
- Deploying to Vercel

> **Note:** the self-hosting setup guide is still being written. For now, `CLAUDE.md` in the repo root has architecture details that will help you get started.

## License

MIT. See [LICENSE](LICENSE).

## Security

Found a security issue? See [SECURITY.md](SECURITY.md) for how to report it privately.

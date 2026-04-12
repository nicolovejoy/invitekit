# Free-vite Data Design & Permissions: Open Questions

This is a living document for thinking through the data model for permissions

## Where We Are Today

Single-tenant model. One hardcoded list of organizer emails. All organizers see all events. Guests access their invite via a magic link UUID — that UUID is the only secret. Firestore rules enforce three roles: organizer, guest (anonymous auth), public.

This works for a small circle of friends throwing dinner parties. It breaks the moment you have two unrelated organizers who shouldn't see each other's events.

## Tension 1: Isolation

Right now, any organizer can see every event and every invite. There's no concept of "my events" vs "your events" beyond `createdBy`. If Alice and Bob are both organizers, Bob can see Alice's guest list, comments, RSVP statuses — everything.

Questions:

- Is the unit of isolation an event? An organizer? A group/org?
- Can an event have multiple organizers? (Co-hosts are common for dinner parties.)
- If co-hosting exists, is it symmetric? Can both organizers edit the guest list, or is one primary?
- What happens to an event if its creator deletes their account?

## Tension 2: Who Can Become an Organizer?

Current model: you're an organizer if your email is in an environment variable. That's a deploy-time decision, not a runtime one.

This obviously doesn't scale. But the replacement isn't obvious either:

- Open self-serve signup? Then what prevents abuse?
- Invite-only? Who sends the invite? Is there a chain of trust?
- Approval queue? Who approves? This implies an admin role that doesn't exist yet.
- Pay wall? Free-vite is... free. But maybe there's a tier.

The name "Free-vite" suggests anyone can use it. But "anyone can create events and email strangers" is a spam vector. The onboarding flow has to balance openness with safety.

## Tension 3: Invite Visibility & Privacy

Guests currently can't see other guests' names/emails — but the Firestore rules allow anyone to read any invite document if they know the token. And organizers can read all invites globally.

As the platform grows:

- Should guests see who else is attending? (Social proof vs privacy.)
- Should organizers see other organizers' guest lists? (Almost certainly not.)
- The invite token is currently the document ID. Anyone who intercepts or guesses a UUID has full read access to that invite. Is that acceptable long-term?
- Can a guest forward their link? Should they be able to? Can we prevent it?

## Tension 4: The Admin Layer

Today there are organizers and guests. No superadmin. No platform-level oversight.

If Free-vite becomes multi-tenant:

- Someone needs to handle abuse reports, account issues, ToS enforcement.
- Is "admin" a separate role, or just an organizer with extra powers?
- Can admins see all event data? Should they? (This conflicts with encryption goals.)
- Moderation: can an admin delete an event? Suspend an organizer? What are the guardrails?

## Tension 5: Sharing Model

Who can share what with whom?

Scenarios that don't have answers yet:

- Organizer wants to add a co-host to their event. How? Forward a link? In-app invitation?
- Guest wants to bring someone not on the list. Do they share their link? Does the +1 get their own invite?
- Organizer wants to hand off an event entirely (e.g., they got sick). Transfer ownership?
- Event templates — can an organizer share their event format/structure with another organizer without sharing the guest data?

## Tension 6: Encryption

The aspiration: encrypt guest data (names, emails, comments, RSVP status) so that even the server/database can't read it. This is a prerequisite for an iOS launch where user trust and App Store review matter.

This is architecturally expensive. If the server can't read the data:

- How do email notifications work? The server currently reads guest names and emails to send invites. If those are encrypted, who decrypts?
- How does search work? An organizer searching for a guest by name can't if the name is encrypted server-side.
- How do Firestore rules work? Rules currently check field values (e.g., `resource.data.uid`). Encrypted fields can't be checked.
- Key management: who holds the keys? Per-event keys? Per-organizer keys? What happens when a key is lost?
- What's the threat model? Protecting against a database breach? A rogue admin? A compromised Vercel deployment? Each answer implies a different encryption scheme.

Possible middle grounds:

- Encrypt at rest in Firestore but decrypt on the server (protects against DB breach, not server compromise)
- Client-side encryption for comments only (the most sensitive user-generated content)
- Encrypt PII (emails, names) but not structural data (event dates, RSVP status)

This tension interacts with every other tension. Encryption makes multi-organizer access harder, admin oversight harder, search harder, email harder.

## Tension 7: Mobile / iOS

The current app is web-only with `signInWithRedirect` for Google auth. An iOS app changes:

- Auth flow — no browser redirects in a native app. Need to use Firebase Auth's native SDK or a different approach.
- Push notifications instead of (or in addition to) email.
- Offline access — guests at a venue with bad signal should still see their invite.
- App Store review — Apple will scrutinize data practices, privacy labels, and user content moderation.
- The anonymous auth model (invisible to guests) may feel different in a native app context.

## Tension 8: Data Lifecycle

Nothing in the current model expires or gets cleaned up:

- When is an event "over"? Currently checked via date comparison in `claim-invite`. But the data lives forever.
- Should old events be archived? Deleted? After how long?
- GDPR/privacy: can a guest request deletion of their data? What does that mean for the organizer's records?
- Anonymous auth accounts accumulate. Firebase has limits. Old anon accounts should probably be cleaned up.

## What This Document Is Not

This is not a roadmap or a backlog.

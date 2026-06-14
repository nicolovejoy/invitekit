# InviteKit — Vision

_Working direction, not a contract. Revisit when the paying-user assumption is tested._

## What it is

A privacy-first invitation + RSVP product for people who host events. Clean, no ads, no guest accounts (the magic-link URL is the credential), and open-source so the guest list can't be quietly harvested.

## Positioning

The incumbents (Partiful, Evite, Paperless Post) are free because the user is the product — guest data is the business. InviteKit's wedge is the inverse: **own-your-data, ad-free, transparent**. The open-source code is what makes that claim credible rather than marketing.

## Business model: open-core SaaS

- **Hosted SaaS is the business.** ~All users and all revenue arrive through the hosted product.
- **Open-source is the moat, not a market.** It does three jobs: trust ("the code is public, we can't sell your data"), anti-rug-pull insurance ("you can leave and self-host"), and a top-of-funnel marketing channel. We do *not* try to serve a self-hoster market — that audience is rounding-error small.

## Target paying user

**Recurring small-org hosts** — clubs, classes, congregations, communities, repeat hosts — not one-off party-throwers. The one-off crowd uses whatever's free and viral; they won't pay and won't switch. Recurring hosts run many events for the *same* group and need things the viral consumer apps ignore: **co-organizers, a member list that persists across events, no ads in front of their members, and their own branding.** They have real willingness to pay.

This reframes existing roadmap work: co-organizers (Permissions Phase 2/3) and the brand/skin system (#19) stop being nice-to-haves and become **the product** — multi-tenant white-label.

## What this means for build order

- The multi-tenant data model (a persistent group/org entity; drop the `ORGANIZER_EMAILS` allowlist) is the spine and moves onto the critical path.
- Keep self-host working — it's cheap and it's the moat — but don't invest in it as a channel.
- **Don't build SaaS machinery (billing, signup, tenant isolation) on spec.** Keep shipping the working single-tenant product while making data-model choices that don't *foreclose* multi-tenancy, until "will a recurring host pay" is validated.

## Open risks / what to test

- Consumer event invites are a monetization graveyard (Partiful still hasn't solved revenue). The bet rests on the *recurring-host* segment having willingness-to-pay the consumer market lacks — that assumption is unproven and should be tested before heavy tenant-infra investment.
- Multi-tenant Firestore rules raise the security stakes materially (isolation bugs leak guest lists).
- Shared email reputation: one spammy tenant can hurt everyone's deliverability.

## Current status

Live and working at free-vite.com: events, magic-link RSVP, anonymous guests, comments, bulk email (5 types), CSV import, tested Firestore-rules security boundary. Single-tenant today; multi-tenant white-label is the next major arc.

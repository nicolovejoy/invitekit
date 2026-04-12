# Security Policy

## Reporting a Vulnerability

If you discover a security issue in InviteKit, please report it privately so
we can investigate and ship a fix before it becomes public.

**Do not open a public GitHub issue for security problems.**

Instead, use GitHub's private vulnerability reporting:
1. Go to the repository's Security tab
2. Click "Report a vulnerability"
3. Describe the issue with reproduction steps

You should receive a response within a few days. If the report is valid, we
will coordinate a fix and credit you in the release notes unless you prefer
to remain anonymous.

## Scope

In-scope issues include:

- Authentication or authorization bypass in Firestore rules
- Leakage of invite tokens, guest data, or organizer credentials
- Server-side request forgery or injection in API routes
- Secrets committed to the repository

Out-of-scope:

- Social engineering of organizers
- Issues in third-party services (Firebase, Resend, Vercel) — report those
  directly to the vendor
- Missing rate limits on public endpoints (known gap, tracked as an issue)

## Self-Hosters

If you fork InviteKit and run your own deployment, you are responsible for
rotating credentials, keeping dependencies up to date, and configuring
Firebase and Vercel securely. Start with the README setup guide.

---
status: Accepted
date: "2026-10-05"
---

# Privy role login and Postgres for the off-chain workflow

## Context

Until now the platform had one password-protected demo console (`ADMIN_PASSWORD`) and two thin user pages: `/farmer` (Privy email wallet, register fields) and `/portfolio` (wallet adapter positions, instant mock KYC). The pilot needs each party to work in its own place: the farmer as issuer of record from application to closing, the investor from onboarding to redemption, the F2F arranger from incoming application to settlement. That workflow has state the chain should not hold (company profiles, KYC answers, document review, application status, audit log), and the arranger must be a named person, not a shared password. The user approved the scope (roles, login model, storage) on 2026-10-05; the design is [the role cabinets spec](../../specs/2026-10-05-role-cabinets.md).

## Decision

- **Sign-in.** Everyone signs in with email through Privy. The browser posts the Privy access token to `POST /api/session`; the server verifies it with `@privy-io/server-auth` (app id `NEXT_PUBLIC_PRIVY_APP_ID`, secret `PRIVY_APP_SECRET`) and stores the token itself in an httpOnly, SameSite=Lax cookie `f2f_session` that expires with the token. Every protected page, server action and route handler verifies the token again and loads the user's roles from Postgres, so a role change applies to the next request. The browser re-posts a fresh token every 10 minutes.
- **Roles.** `farmer`, `investor`, `arranger`, stored in `user_roles`. A new account chooses farmer or investor once (granted at once; onboarding gates what it can do). Emails in `ARRANGER_EMAILS` get `arranger` when the account is first attached to Privy. Arrangers grant and revoke roles by email; nobody can remove their own arranger role or the last arranger.
- **Cabinets.** `/farmer`, `/investor` (replaces `/portfolio`), `/arranger` (replaces `/admin`). The legacy `ADMIN_PASSWORD` login is removed. Basic auth (ADR 0015) stays in front of everything.
- **Server keys unchanged.** Issuer, compliance, SCAS-stub and sponsor keys keep signing on-chain operations; the role guard decides who may trigger them. Every arranger decision and on-chain action writes `audit_log` with its signatures or its error.
- **Storage.** Postgres on Railway (service `Postgres` in project `field-to-finance`), Drizzle ORM with SQL migrations committed in `apps/web/drizzle/`, applied by a Railway pre-deploy command. Documents stay in the bucket by SHA-256; the chain keeps money, rights, hashes and attestations.
- **Privacy.** BIN, legal names, cadastral numbers, investor names and emails live only in Postgres and the bucket, never on-chain, in the repository, in logs, analytics or GlitchTip.
- **Compliance gates.** Investor KYC is decided by an arranger (no more instant approval at `/api/kyc`, which now answers 410). Before the first subscription to a pool the investor accepts its key features document (KFD), recorded with the document's SHA-256 in `kfd_acceptances`; `/api/tx/subscribe` refuses a wallet that is not linked to an onboarded investor with a current acceptance.
- **Status machine.** Applications move `draft → submitted → documents_review → kyc → field_verification → structuring → ready` by explicit gated steps; from `open` on the status is derived from the on-chain pool and cached in the row.

## Consequences

- The platform now has a database to run, back up and migrate. A Postgres outage closes the cabinets and pauses subscriptions (the gate fails closed); pool pages, refunds, redemptions and grain claims keep working from chain data.
- Existing approved investor wallets stay approved on-chain, but a wallet must be linked to an investor account and accept a pool's KFD before its next first subscription to that pool.
- The session cookie carries a short-lived Privy token, not a server-side session id, so signing out of the platform clears the cookie and revocation of Privy sessions is handled by Privy. Roles are never cached in the cookie.
- `@privy-io/server-auth` is marked deprecated in favour of `@privy-io/node`; it is wrapped in one adapter (`src/lib/auth/privy-port.ts`), so a later swap touches one file.
- Local screenshots and scripts can sign in with `dev:<email>` tokens when `F2F_DEV_AUTH=1` outside production; production ignores the flag.

## Alternatives considered

- Privy's own httpOnly cookie: needs a custom domain registered with Privy; the pilot runs on the Railway domain.
- A server-side session table: one more moving part; verifying the Privy token on each request already gives revocation through Privy and keeps roles fresh from Postgres.
- Keeping workflow state in the bucket as JSON (like the onboarding manifest): no queries, no constraints, no audit trail.
- On-chain workflow state: puts private identifiers and review decisions on a public ledger.

## Related code

- `apps/web/src/lib/auth/`, `apps/web/src/lib/server/auth.ts`, `apps/web/src/app/api/session/route.ts`
- `apps/web/src/lib/db/`, `apps/web/drizzle/`, `apps/web/scripts/migrate.ts`
- `apps/web/src/lib/workflow/`, `apps/web/src/app/{farmer,investor,arranger}/`

## Related docs

- [Web app](../../systems/web.md), [Data](../../systems/data.md)
- [Farmer onboarding](../../flows/farmer-onboarding.md), [Investor onboarding](../../flows/investor-onboarding.md), [Issuance pipeline](../../flows/issuance-pipeline.md)
- [ADR 0011](0011-platform-level-kyc.md), [ADR 0014](0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md), [ADR 0015](0015-basic-auth-on-the-pilot-platform.md)

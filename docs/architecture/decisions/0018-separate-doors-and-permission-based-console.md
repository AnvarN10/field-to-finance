---
status: Accepted
date: "2026-10-07"
---

# Separate doors and a permission-based console

Accepted: user decision 2026-10-07 (entry model "separate doors"; one back-office console with permission-based roles; benchmarks from RWA tokenization and crowdlending platforms).

## Context

ADR 0016 let every new account choose "I am a farmer" or "I am an investor" after sign-in, and ADR 0017 gave each service party (compliance, SCAS partner, elevator, laboratory, regulator) its own cabinet next to the arranger's. The founder found the flow and the navigation strange for a real platform: the public top bar lists every cabinet to every visitor, a role picker follows sign-in, and staff and partners move between six cabinets. The research in [docs/research/cabinets-ux/report-ru.md](../../research/cabinets-ux/report-ru.md) shows that investment and lending platforms (Securitize, Tokeny, Centrifuge, Maple, Mintos, Bondora, iKapitalist, FarmTogether, AcreTrader, Funding Circle) give investors and borrowers separate entry points, invite staff and partners into one back office, and decide what each back-office user sees by permissions. The design is in [the cabinets redesign spec](../../specs/2026-10-07-cabinets-redesign.md).

## Decision

- **Doors.** Investors self-register at `/invest/signup`; farmers start at `/apply` ("Get financing") and sign up at `/apply/start`; console users join only through an invitation link `/invite/<token>`. The account kind comes from the door, never from a choice after sign-in. Returning users share `/sign-in` and land in their own app; an email without an account sees the two doors.
- **Apps.** Investor app `/invest/*` and issuer workspace `/issuer/*`, each with its own top navigation. One console `/console/*` with a left navigation replaces `/arranger`, `/compliance`, `/scas`, `/elevator` and `/regulator`. Every old URL redirects (temporary redirects).
- **Permissions.** Authorization checks permissions (`src/lib/permissions.ts`), never role names. Console roles (`arranger`, `compliance`, `scas`, `elevator`, `lab`, `regulator`) are named permission bundles defined in code and pinned by a test; a user's permissions are the union of their roles' bundles. The bundles reproduce today's authority: the arranger holds every permission (the ADR 0017 pilot fallback), each partner keeps its single step, the regulator is read-only. `audit_log.acting_role` keeps recording the service role of the step (ADR 0017).
- **Storage.** Roles stay in `user_roles` (no data migration). A new table `console_invitations` holds invitations: email, roles, the SHA-256 of a 256-bit random token (never the token), expiry (7 days), acceptance and revocation. Acceptance requires the signed-in email to match, runs in one transaction with the invitation row locked, and is single use.
- **Team management.** Users with `team.manage` invite, change roles and remove console members. Granting `farmer` or `investor` by email is removed. `ARRANGER_EMAILS` stays as the bootstrap, and the last-arranger rules stay.

## Consequences

- No role picker and no cross-audience navigation; each audience sees one app. Partners see only the console sections their permissions open.
- Adding a permission or changing a bundle is a code change with a test, not a database edit. Custom roles would need a table later.
- Invitations are delivered by copying the link shown once in the console (no email service in the pilot). A leaked link is useless without the invited email's Privy sign-in, and expires in 7 days.
- One account can be a console member and also hold one self-service account kind; the account menu links between them.
- ADR 0016's role choice and ADR 0017's separate service cabinets are superseded in their entry and navigation parts; their workflows, keys and audit contract stay.

## Alternatives considered

- Keep the role picker and polish the cabinets: does not match any studied platform and keeps the cross-audience navigation.
- Permissions per user in the database (custom roles now): more surface and a seed to keep in sync with code, for no pilot need.
- Separate consoles per partner (status quo): more screens to keep consistent, no shared inbox, and partners see cabinet navigation that does not apply to them.
- Invitation by direct role grant on an email (status quo): no consent step, no expiry, no audit of acceptance.

## Related code

- `apps/web/src/lib/permissions.ts`, `apps/web/src/lib/workflow/guards.ts`, `apps/web/src/lib/workflow/team.ts`, `apps/web/src/lib/server/auth.ts`
- `apps/web/src/app/{invest,issuer,apply,console,invite,sign-in}/`, `apps/web/drizzle/0003_console_invitations.sql`, `apps/web/src/lib/redirects.ts`

## Related docs

- [Cabinets redesign spec](../../specs/2026-10-07-cabinets-redesign.md), [research report](../../research/cabinets-ux/report-ru.md)
- [Web app](../../systems/web.md), [Data](../../systems/data.md), [ADR 0016](0016-privy-role-login-and-postgres-for-off-chain-workflow.md), [ADR 0017](0017-service-role-cabinets.md)

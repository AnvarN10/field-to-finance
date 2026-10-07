# Cabinets redesign: separate doors and one permission-based console

Status: decisions by the user on 2026-10-07 (binding): separate doors, one back-office console with permission-based roles, benchmarks from RWA tokenization and crowdlending platforms. Research: [docs/research/cabinets-ux/report-ru.md](../research/cabinets-ux/report-ru.md). Decision record: [ADR 0018](../architecture/decisions/0018-separate-doors-and-permission-based-console.md). Replaces the entry and navigation parts of the [role cabinets spec](2026-10-05-role-cabinets.md) and the cabinet layout of the [complete platform spec](2026-10-05-platform-complete.md); their workflows, on-chain flows and data stay.

## 1. Problem

After Privy sign-in a new user sees "How will you use Field-to-Finance? I am a farmer / I am an investor". The top bar lists "Pools / Investor / Farmer / Arranger" to every visitor, and six service parties each have a separate cabinet (`/arranger`, `/compliance`, `/scas`, `/elevator`, `/regulator`). No regulated platform we studied works this way:

- Investors and borrowers enter through different doors with different promises (Mintos, Bondora, iKapitalist, FarmTogether, AcreTrader, Funding Circle: "Invest" and "Get financing" or "Raise capital" are separate calls to action with separate sign-up flows; Securitize and Tokeny separate the investor portal from the issuer console).
- Staff and partners never pick a role. They are invited into one back office, and what they see depends on permissions (Securitize issuer roles, Tokeny agent roles, Stripe team roles).
- The audience of each app sees only its own navigation.

## 2. Goals

1. Three front doors, no role picker: investors self-register (`/invest/signup`), farmers apply (`/apply`), service parties are invited into the console (`/invite/<token>`). Returning users of any kind use one sign-in page and land in their own app.
2. One back-office console (`/console`) with a left navigation and work queues. Each console user's permissions decide which sections, records and buttons they see. External partners (SCAS, elevator, laboratory, regulator) are console users with narrow permissions.
3. Authorization is by permission, not by role name, in pages, server actions, route handlers and workflows. Roles are named permission bundles.
4. An investor app and an issuer workspace with their own top navigation, modelled on the benchmarks (overview, portfolio, activity and statements, account; applications, obligations, company).
5. Nothing that works today breaks: every on-chain flow (subscribe, refund, redeem, grain claim, register project, election, buyback funding, attestations, delivery records, pool lifecycle), the KFD gate, the sponsor validator, the audit log, notifications and the regulator export keep working, and every old URL redirects.

Out of scope: email delivery of invitations (the console shows the link once to copy), custom roles editable in the UI, maker-checker approvals, impersonation ("view as"), a real KYC provider. See section 12.

## 3. Entry points and URL structure

### 3.1 Choice of prefixes

| Area | Prefix | Why |
| --- | --- | --- |
| Investor app | `/invest/*` | A verb for the audience's job, as "Invest" on Mintos, Bondora and FarmTogether. Separate from the public `/pools` catalogue so the catalogue stays readable without an account. |
| Farmer door | `/apply` | The public "Get financing" page and its sign-up. Farmers start by applying, as on Funding Circle and iKapitalist (borrower application first). |
| Issuer workspace | `/issuer/*` | The farmer company is the issuer of record of its pool (ADR 0014); the workspace is about its issue, its obligations and its company file. Securitize and Tokeny use the same word for this side. |
| Console | `/console/*` | One back office for staff and partners, invitation only. A neutral word: "admin" suggests full power, which partners do not have. |
| Invitation | `/invite/<token>` | Outside `/console` so a visitor without console access can open it. |

### 3.2 URL map

| URL | Who | What |
| --- | --- | --- |
| `/` | anyone | Landing. Calls to action: "Start investing" (primary, `/invest/signup`) and "Get financing" (secondary, `/apply`). |
| `/pools`, `/pools/[id]`, `/fields/[address]` | anyone | Public catalogue and pool pages (unchanged). The invest button on a pool page leads to `/invest/pools/[id]`. |
| `/sign-in` | returning users | One page for everyone. After sign-in: console member to `/console`, issuer to `/issuer`, investor to `/invest`; `?next=` wins when it is a same-origin path. An email without an account sees "No account for this email" with the two doors. |
| `/invest/signup` | new investors | What investing involves, risk warning, then "Continue with email". The investor account opens right after sign-in; next stop `/invest/account`. |
| `/invest` | investor | Overview: value of positions at maturity, accrued coupon, test USDC in linked wallets, next payment, verification banner, upcoming payments, updates. |
| `/invest/opportunities` | investor | Listed pools with terms, a link to each pool's invest page. |
| `/invest/pools/[id]` | investor | Key features document gate, then the invest panel (unchanged behaviour). |
| `/invest/portfolio` | investor | Positions with accrued coupon and settlement path, maturity schedule, grain claims, test funds. |
| `/invest/activity` | investor | Transaction history and the CSV statement. |
| `/invest/account` | investor | Verification steps (category, identity check, risk acknowledgement), linked wallets. |
| `/apply` | anyone | Public page: what F2F finances, requirements checklist, steps and timing, "Start application". |
| `/apply/start` | new farmers | Sign-up for the issuer workspace: "Continue with email"; the issuer account opens right after sign-in; next stop `/issuer/company`. |
| `/issuer` | farmer | Overview: next action with its owner, applications, obligations summary, updates. |
| `/issuer/applications`, `/new`, `/[id]` | farmer | Applications with document checklist, fields and status timeline (unchanged behaviour). |
| `/issuer/obligations` | farmer | Amount due, Act/360 accrual, election and buyback funding, payouts and fees. |
| `/issuer/company` | farmer | Company profile and issuer KYC. |
| `/invite/[token]` | invitee | Invitation card, sign-in with the invited email, accept. |
| `/console/**` | console members | See section 6. |

### 3.3 Redirects from the old URLs

Configured in `next.config.ts` `redirects()` as temporary redirects (307), not permanent ones, so browsers do not cache them while the pilot may still rename; query strings pass through.

| Old | New |
| --- | --- |
| `/admin`, `/arranger` | `/console` |
| `/arranger/applications/:id` | `/console/applications/:id` |
| `/arranger/investors` | `/console/investors` |
| `/arranger/pools` | `/console/pools` |
| `/arranger/pools/:id` | `/console/pools/:id` |
| `/arranger/roles` | `/console/team` |
| `/arranger/audit` | `/console/audit` |
| `/arranger/treasury` | `/console/settings` |
| `/compliance` | `/console/issuers` |
| `/compliance/investors` | `/console/investors` |
| `/compliance/limits` | `/console/investors/limits` |
| `/scas` | `/console/verification` |
| `/scas/pools/:id` | `/console/verification/pools/:id` |
| `/elevator` | `/console/delivery` |
| `/regulator` | `/console/registry` |
| `/regulator/pools/:id` | `/console/registry/pools/:id` |
| `/regulator/events` | `/console/registry/events` |
| `/investor`, `/portfolio` | `/invest` |
| `/investor/onboarding` | `/invest/account` |
| `/investor/pools/:id` | `/invest/pools/:id` |
| `/farmer` | `/issuer` |
| `/farmer/onboarding` | `/issuer/company` |
| `/farmer/applications` | `/issuer/applications` |
| `/farmer/applications/:id` (incl. `new`) | `/issuer/applications/:id` |

Notification rows already stored with old `link` values keep working through these redirects; new rows use the new paths.

## 4. Sign-up and sign-in

### 4.1 Doors

- `/invest/signup` and `/apply/start` render the same `DoorSignup` component with `door = investor | issuer`. The page states what the account is for, then "Continue with email" (Privy). After the session is established (`POST /api/session`), the browser calls the server action `openAccountAction(door)`.
- `openAccount(db, user, door)` (workflow, replaces `chooseRole`) grants `investor` or `farmer` with `granted_by = user_id`, creates the profile, audits `account.open` with the door. It is idempotent for the same door (an account that already has it is returned as is) and refuses the other door with 409 "This email already has an issuer account" / "an investor account" (the unique index `user_roles_one_self_cabinet` stays, one self-service account kind per email).
- A visitor who is already signed in and opens a door page with the matching account goes straight to the app; with the other account kind sees the 409 message with a link to their own app and "Use another email".

### 4.2 Sign-in

- `/sign-in` says "Sign in to Field-to-Finance" and offers "Continue with email". Below: "New here? Start investing · Apply for financing".
- After the session is established, `homeFor(user)` decides: `/console` if the user holds any console role, else `/issuer` for `farmer`, else `/invest` for `investor`, else the "No account for this email" state (two door links, "Use another email"). No role choice is offered.
- `next` is honoured only through `safeNext` (same origin, no `//`, no backslash).

### 4.3 Header

- Public pages: logo, "Pools", "Get financing", "Sign in", primary "Start investing". When a session exists, `GET /api/session` returns `{ signedIn, home }` and "Sign in" plus "Start investing" become one "Open app" link to `home`.
- Investor app and issuer workspace: logo, the app's own tabs, notification bell, account menu (email, links to other apps the user has, sign out).
- Console: its own shell (section 6).

## 5. Permission model

### 5.1 Concepts

- **Account kinds** (self-service): `investor`, `farmer` (issuer). Stored in `user_roles` as today. They gate the investor app and the issuer workspace.
- **Console roles**: `arranger`, `compliance`, `scas`, `elevator`, `lab`, `regulator`. Stored in `user_roles` as today (no data migration). Granted only by accepting an invitation, by a team manager changing a member's roles, or by the `ARRANGER_EMAILS` bootstrap.
- **Permissions**: code constants in `src/lib/permissions.ts`. Every console page, server action, route handler and workflow checks a permission (`can(user, permission)`, `assertPermission(user, permission)`), never a role name. A role is a named bundle: `ROLE_PERMISSIONS[role]`. A user's permissions are the union over their console roles.
- **Acting role**: `audit_log.acting_role` keeps ADR 0017's meaning: the service role whose step was performed (`compliance`, `scas`, `elevator`, `lab`), whether the actor holds that role or is an arranger acting for it. `assertPermission` also reports the user's narrowest granting role for display.

Bundles live in code, not in the database: they change with the code that checks them, are reviewed in pull requests and are covered by a test that pins the matrix. Custom roles are deferred (section 12).

### 5.2 Permissions

| Permission | Allows |
| --- | --- |
| `applications.view` | Applications list and record pages, pipeline counts. |
| `applications.review` | Accept or reject documents, advance an application up to structuring, reject an application. |
| `pools.structure` | Term builder (create pool with InstrumentTerms, add project), publish, manual create-pool and onboarding tools. |
| `issuers.view` | Issuer records with legal name, BIN, contact and issuer KYC files. |
| `investors.view` | Investor records with name, country, IIN, questionnaire, retail limit monitor. |
| `kyc.decide` | Approve or reject issuer KYC (writes the on-chain record) and investor KYC (and approve a wallet). |
| `kyc.revoke` | Revoke an investor (`revoke_investor` per held pool). |
| `pools.view` | Live pools, lifecycle boards, pool record, final report CSV. |
| `pools.operate` | Close subscription, disburse, record settlement, open redemption, elect for the issuer, fund redemption, sweep, close; the settlement queue. |
| `verification.attest` | Verification queue, verify fields, season attestations (SCAS). |
| `delivery.receipt` | Record the elevator receipt. |
| `delivery.lab` | Record the 12-parameter lab protocol. |
| `registry.view` | Regulator registry: issues, holders with category and IIN, issuer legal name and BIN, whitelisted events. |
| `registry.export` | Registry, holders and events CSV. |
| `documents.view` | Download any stored document (application documents, service uploads, delivery papers). Without it: own uploads, plus issuer KYC files with `issuers.view`. |
| `audit.view` | Full audit log. |
| `team.manage` | Invite members, change their roles, remove them, revoke invitations. |
| `settings.manage` | Fees and treasury, test USDC mint. |

### 5.3 Role bundles (the matrix)

| Permission | arranger | compliance | scas | elevator | lab | regulator |
| --- | --- | --- | --- | --- | --- | --- |
| applications.view | ✓ | | | | | |
| applications.review | ✓ | | | | | |
| pools.structure | ✓ | | | | | |
| issuers.view | ✓ | ✓ | | | | |
| investors.view | ✓ | ✓ | | | | |
| kyc.decide | ✓ | ✓ | | | | |
| kyc.revoke | ✓ | ✓ | | | | |
| pools.view | ✓ | | | | | |
| pools.operate | ✓ | | | | | |
| verification.attest | ✓ | | ✓ | | | |
| delivery.receipt | ✓ | | | ✓ | | |
| delivery.lab | ✓ | | | | ✓ | |
| registry.view | ✓ | | | | | ✓ |
| registry.export | ✓ | | | | | ✓ |
| documents.view | ✓ | | | | | |
| audit.view | ✓ | | | | | |
| team.manage | ✓ | | | | | |
| settings.manage | ✓ | | | | | |

This reproduces today's authority exactly: the arranger may act for every service party (ADR 0017 pilot fallback); partners keep their single step; the regulator stays read-only; the SCAS partner, elevator and laboratory still see no company identity. The only new capability is the invitation flow, and it is guarded by `team.manage`.

### 5.4 Database changes (additive migration `0003_console_invitations`)

- New table `console_invitations`: `id` uuid pk; `email` text not null (lower case); `roles` text[] not null, non-empty, every element a console role (check); `token_hash` text not null unique (SHA-256 hex of the token); `invited_by` uuid references users on delete set null; `created_at`; `expires_at` not null; `accepted_at`, `accepted_by` (references users, set null); `revoked_at`, `revoked_by`. Partial unique index: one open invitation per email (`accepted_at is null and revoked_at is null`).
- No change to `user_roles`, so no backfill: existing service-role holders and arrangers keep their access, now expressed through the bundles.

### 5.5 Invitations

- **Create** (`team.manage`): email plus one or more console roles. Any open invitation for that email is revoked in the same transaction. The token is 32 random bytes from `crypto.randomBytes`, base64url; only its SHA-256 is stored. The console shows the link once (`<PUBLIC_BASE_URL or request origin>/invite/<token>`) with a copy button and the expiry (7 days). Audit `team.invite` with email domain-free payload (roles, invitation id; the email is the target).
- **Open** `/invite/[token]`: looks up the hash. States: valid (shows the roles in plain words and the masked invited email), expired, revoked, already used, unknown (one generic "This invitation link is not valid" for unknown, so tokens cannot be probed for state beyond that). The page sends `Referrer-Policy: no-referrer` and is never cached.
- **Accept** (server action, signed in): in one transaction lock the invitation row (`for update`), require it open and unexpired, require the session email to equal the invited email (else 403 "This invitation is for another email"), insert each role into `user_roles` with `granted_by = invited_by`, set `accepted_at`, `accepted_by`. Audit `team.invitation.accept`, notify the inviter. Then redirect to `/console`.
- **Revoke** (`team.manage`): sets `revoked_at`; audit `team.invitation.revoke`.
- **Members**: the Team page lists console members (users with any console role) with roles and last grant; a team manager edits a member's role set or removes them from the console. The last-arranger rule and the `ARRANGER_EMAILS` rule stay (no removing your own arranger role, keep at least one arranger, addresses in `ARRANGER_EMAILS` cannot lose it here).
- Direct grant by email of `farmer` or `investor` is removed: those accounts open through the doors.

## 6. Console

### 6.1 Shell

- Left navigation on desktop (≥1024px), 240px, items filtered by permission; a top bar with the page title area, notification bell and account menu. Under 1024px the navigation moves into a "Menu" sheet opened from the top bar.
- Items, in order, each shown when the user holds its permission:

| Item | URL | Permission |
| --- | --- | --- |
| Inbox | `/console` | any console role |
| Applications | `/console/applications` | `applications.view` |
| Issuers | `/console/issuers` | `issuers.view` |
| Investors | `/console/investors` | `investors.view` |
| Pools | `/console/pools` | `pools.view` |
| Settlement | `/console/settlement` | `pools.operate` |
| Verification | `/console/verification` | `verification.attest` |
| Delivery | `/console/delivery` | `delivery.receipt` or `delivery.lab` |
| Registry | `/console/registry` | `registry.view` |
| Audit | `/console/audit` | `audit.view` |
| Team | `/console/team` | `team.manage` |
| Settings | `/console/settings` | `settings.manage` |

- Every page guards itself (`guardConsole(permission, path)`): signed out to `/sign-in?next=`; no console role to a 403 that names what is missing and points to the user's own app; a missing permission to a 403 inside the shell. The layout is not a security boundary; pages, actions and routes are.

### 6.2 Inbox

Work queues computed from the database and the chain, each shown only with its permission, each with a count, the five oldest items and "Open queue":

| Queue | Permission | Items |
| --- | --- | --- |
| Applications to review | `applications.review` | statuses where the arranger acts next: `submitted`, `documents_review`, `structuring`, `ready` |
| Issuer KYC | `kyc.decide` | farmer profiles with `kyc_status = pending` |
| Investor KYC | `kyc.decide` | investor profiles with `kyc_status = pending` |
| Fields to verify | `verification.attest` | applications in `field_verification` with fields registered |
| Pool actions | `pools.operate` | pools whose lifecycle board says the arranger acts next |
| Elevator receipts | `delivery.receipt` | term-sheet pools on the delivery path without a receipt |
| Lab protocols | `delivery.lab` | term-sheet pools on the delivery path without a lab protocol |

An empty inbox says "Nothing waiting for you" and lists the sections the user can open. A regulator's inbox shows the registry summary instead of queues.

### 6.3 Sections

Existing cabinet pages move into the console with their behaviour unchanged; only the guard and the frame change.

- **Applications**: the pipeline board with status filters (from `/arranger`), the application record (from `/arranger/applications/[id]`) with documents, issuer KYC link, verification, term builder, publish, reject. Buttons render only with `applications.review` or `pools.structure`.
- **Issuers**: issuer KYC queue and decisions (from `/compliance`).
- **Investors**: investor KYC with decisions and revocation (from `/compliance/investors`; the arranger's read view merges into it); "Retail limits" sub-tab (from `/compliance/limits`). Decision buttons render with `kyc.decide`, revoke with `kyc.revoke`.
- **Pools**: live pools and the pool record with the lifecycle board, final report and manual pilot tools (from `/arranger/pools`, `/arranger/pools/[id]`). Operating buttons render with `pools.operate`; structuring tools with `pools.structure`.
- **Settlement**: pools at maturity or on the settlement path, each with its lifecycle board settlement phase and its next action.
- **Verification**: SCAS queue and season attestations (from `/scas`, `/scas/pools/[id]`).
- **Delivery**: elevator receipt and lab protocol (from `/elevator`), each form shown with its permission.
- **Registry**: registry, holders, events, CSV export (from `/regulator/**`); export links render with `registry.export`.
- **Audit**: the full audit log (from `/arranger/audit`).
- **Team**: members, open invitations, invite form, and the read-only permission matrix of section 5.3.
- **Settings**: fees and treasury, test USDC mint (from `/arranger/treasury`).

### 6.4 Server actions and routes

- Console server actions move to `src/app/console/_actions/*` and call `consoleAction(permission, message, fn)` (replaces `serviceAction` and the arranger `run`/`wf` helpers): permission check first, then the workflow, which re-checks its permission and audits with the acting role.
- `GET /api/regulator/export` requires `registry.export`; `GET /api/arranger/report/[poolId]` requires `pools.view`; `GET /api/documents/[hash]` follows `documents.view` / `issuers.view` (KYC files) / uploader.
- `/api/tx/*`, the sponsor validator, the KFD gate, `/api/faucet`, `/api/notifications`, `/api/investor/statement` (investor account) are unchanged.

## 7. Investor app

Top bar tabs: Overview, Opportunities, Portfolio, Activity, Account.

- **Overview** (`/invest`): a verification banner while onboarding is incomplete ("Verify your account to invest", one primary link); four figures: value of positions at maturity, accrued coupon to date, test USDC in linked wallets, next payment (amount and date); upcoming payments (the maturity schedule, next five); latest updates. Empty state with no positions: "No investments yet" and a link to Opportunities.
- **Opportunities** (`/invest/opportunities`): listed pools (`HIDDEN_POOL_IDS` respected) with crop, coupon, term, raised and status; each links to `/invest/pools/[id]`.
- **Pool** (`/invest/pools/[id]`): unchanged: KFD gate, then the invest panel.
- **Portfolio** (`/invest/portfolio`): positions table (tokens, nominal, accrued coupon, at maturity, settlement path, action), maturity schedule, grain claims, test funds per wallet.
- **Activity** (`/invest/activity`): history (subscriptions, refunds, redemptions, grain claims with explorer links), "Download statement (CSV)".
- **Account** (`/invest/account`): verification steps (category with retail limits, mock KYC, risk acknowledgement), wallets (Privy embedded, Phantom link by signed message), KYC status.

## 8. Issuer workspace

Top bar tabs: Overview, Applications, Obligations, Company.

- **Overview** (`/issuer`): next action card (what, who owns it, one link) derived from profile completeness, issuer KYC and the newest application's status; applications (latest five); obligations summary (amount due and date per pool, link to Obligations); updates.
- **Applications**: unchanged list, form and record with document checklist, fields, status timeline.
- **Obligations** (`/issuer/obligations`): obligations per pool (amount due at maturity, Act/360 accrual, election, buyback funding with the Privy wallet), payouts and fees history.
- **Company** (`/issuer/company`): company profile and issuer KYC (from `/farmer/onboarding`).

## 9. What stays

All on-chain flows and server-built user transactions; the sponsor validator and rent budget; the KFD gate on subscribe; server-held keys and which key signs what; the workflow layer and its audit rows (with `acting_role`); notifications (with new link paths); the status machine and chain refresh; basic auth; `ARRANGER_EMAILS` bootstrap; the Night field style lock (the console's left navigation is recorded in the style lock as the console shell); privacy rules (regulator sees BIN and IIN but no emails or KYC answers; partners see no company identity).

## 10. Error handling

- Postgres down: every app and the console show their error state; public pages work.
- Invitation errors are plain sentences; nothing reveals whether an email has an account.
- A permission missing on an action answers 403 "You do not have permission to <verb>"; the UI does not render buttons the user cannot use.

## 11. Testing

- Permission matrix pinned by a test; `can`, `assertPermission` and the acting-role choice.
- Invitations on PGlite: create stores only the hash, re-invite revokes the previous one, accept with the wrong email, expired, revoked, reused, concurrent accept (one wins), role grant and audit.
- Every console server action refuses a user without its permission (table-driven over the actions), and the workflows refuse too.
- Routes: regulator export, report, documents by permission.
- Redirects: every old path maps to its new path (pure function over the redirect table, plus `next.config` uses it).
- Doors: `openAccount` idempotence, cross-door refusal, `homeFor`.
- Components: console nav filtered by permissions, inbox queues by permission, door sign-up states, sign-in no-account state.
- The suite stays green; `tsc` clean; `next build` green.

## 12. Deferred

- Email delivery of invitations (Privy or an email provider); the link is copied by hand.
- Custom roles edited in the console; per-member permission overrides.
- Maker-checker (four-eyes) for KYC approvals, disbursement and sweep.
- Read-only impersonation ("view as investor/issuer") for support.
- Secondary market, tax documents, statement PDFs.

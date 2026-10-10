# Web app

## Purpose

`apps/web` is the only deployed service. It shows Pools, Fields and Attestations from devnet and hosts three apps behind Privy email sign-in ([ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md), [ADR 0018](../architecture/decisions/0018-separate-doors-and-permission-based-console.md)): the investor app (`/invest`: onboarding, key features documents, subscribe, redeem, grain claims, portfolio and statements), the issuer workspace (`/issuer`: the farmer company applies, registers fields, elects the settlement and funds the buyback) and one back-office console (`/console`) where the arranger, compliance, the SCAS partner, the elevator, the laboratory and the regulator work with permission-based roles. Investors and farmers enter through separate sign-up doors (`/invest/signup`, `/apply`); console members join by invitation (`/invite/<token>`). Server-held keys sign for the service roles. Off-chain workflow data lives in Postgres ([data.md](data.md)).

## Questions this doc answers

- Where do privileged keys live and who can use them?
- How does a user transaction get built, signed and confirmed?
- How are reads cached and when are they refreshed?
- What does the SCAS stub write and sign?
- How do sign-in, the doors, permissions and the console work?

## Scope

Pages, the apps and the console, sign-in, doors, invitations and the permission guards, route handlers, server actions, the workflow layer over Postgres, the read layer over Program accounts, server-built transactions, the SCAS stub, polygon, evidence and document storage, the test-USDC faucet, GlitchTip and PostHog.

## Non-scope

- Program rules: see [program.md](program.md).
- Tables, migrations and data privacy: see [data.md](data.md).
- Real KYC, the fiat on-ramp and a real SCAS provider.

## Key concepts

Pool, Instrument, Farm Project, Field, Attestation, KYC Thaw, Shortfall, Door, Console, Permission, Invitation, Application, Key Features Document. See the [glossary](../glossary.md).

## How the system works

- **Sign-in, doors and home** ([ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md), [ADR 0018](../architecture/decisions/0018-separate-doors-and-permission-based-console.md)). Privy loads on the sign-in page, the doors, the invitation page and inside the apps (`components/auth/auth-provider.tsx`). After the email code the browser posts Privy's access token to `POST /api/session`; the server verifies it with `@privy-io/server-auth`, creates the account on first sign-in (granting `arranger` when the email is in `ARRANGER_EMAILS`), records the Privy embedded wallet and stores the token in the httpOnly cookie `f2f_session` until it expires; the browser re-posts a fresh token every 10 minutes. `currentUser()` (deduplicated per request with React `cache`) verifies the cookie and loads roles from Postgres. There is no role choice: `/invest/signup` and `/apply/start` render `DoorSignup`, which calls `openAccountAction(door)` right after sign-in (`src/lib/workflow/accounts.ts`: opens `investor` or `farmer`, idempotent, 409 for the other door's account, one self-service account kind per email by the unique index). `/sign-in` sends an account home with `homeFor` (`src/lib/auth/home.ts`: any console role → `/console`, `farmer` → `/issuer`, `investor` → `/invest`) or to a safe `next`; an email without an account sees the two doors. `GET /api/session` tells the public header whether a session exists and where home is. The proxy sends `/console`, `/issuer` and `/invest` page loads without the cookie to `/sign-in?next=` (a hint only); `/invest/signup` stays open. Old cabinet URLs redirect (`src/lib/redirects.ts`, temporary redirects in `next.config.ts`).
- **Permissions** ([ADR 0018](../architecture/decisions/0018-separate-doors-and-permission-based-console.md)). `src/lib/permissions.ts` defines 18 permissions and the console role bundles (arranger: all; compliance: issuers.view, investors.view, kyc.decide, kyc.revoke; scas: verification.attest; elevator: delivery.receipt; lab: delivery.lab; regulator: registry.view, registry.export), pinned by `test/permissions.test.ts`. Pages use `guardConsole(permission, path)` (sign-in redirect, "invitation only" for non-members, a missing-permission state inside the shell, or an error state), console actions `consoleAction(permission, message, fn)` (`src/lib/server/console-action.ts`) or the pool console `run` with a declared permission, routes `requirePermission`; workflows check again with `assertPermission` and keep writing `audit_log.acting_role` with the service role of the step. The investor app and issuer workspace use `guardAccount(kind, path)` and `requireAccount(kind)`.
- **Workflow layer.** Business rules live in `src/lib/workflow/*` (farmer, investor, arranger, accounts, team, inbox, audit, notifications), framework-free and taking a Drizzle `Db` plus an `ArrangerChain` port, so server actions, tests (PGlite) and the devnet scripts run the same code. Every arranger decision and on-chain action writes `audit_log` with signatures or the error. Application statuses follow `src/lib/application-status.ts`; from `open` on they are derived from the pool and cached (refreshed after console actions and, at most every 30 s, on page loads).
- **Investor app** (`/invest`): Overview (value at maturity, accrued coupon, test USDC in linked wallets, next payment, verification banner, upcoming payments, updates; `src/lib/invest-summary.ts`), Opportunities (listed pools leading to `/invest/pools/<id>`), the pool page (key features document, hash computed on the server, then the invest panel for subscribe, refund, redeem and grain claims with the email wallet or Phantom), Portfolio (positions across linked wallets with accrued coupon, settlement path, maturity schedule, grain claims, test funds), Activity (history from sponsored transactions, CSV statement at `/api/investor/statement`), Account (category with retail limits, mock KYC reviewed by compliance, risk acknowledgement, Privy wallet and Phantom link by signed message). See [investor onboarding](../flows/investor-onboarding.md).
- **Issuer workspace** (`/issuer`): Overview (one next step with its owner from `src/lib/issuer-next-action.ts`, in the farmer's words; applications; obligations summary; updates), Applications (create, one document per requirement with per-document status and re-upload after rejection, fields with GeoJSON/KML import and the sponsored `register-project` signed by the Privy wallet, submit, withdraw, status timeline), Obligations (amount due at maturity, Act/360 accrual, maturity, election, buyback funding against the vault, payouts and fees; `src/lib/server/issuer-data.ts`), Company (profile and issuer KYC document). `/apply` explains what F2F finances and the requirement checklist. See [farmer onboarding](../flows/farmer-onboarding.md).
- **Console** (`/console`, ADR 0018): left navigation filtered by permission (`components/console/nav-items.ts`), a menu panel under 1024px. Inbox: work queues per permission (`src/lib/workflow/inbox.ts`: applications to review, issuer and investor KYC, fields to verify, pool actions where the arranger acts next, elevator receipts, lab protocols; partner-visible labels carry no company identity). Applications (pipeline and application record with documents, term builder, publish, reject), Issuers (issuer KYC decisions with BIN and KYC file), Investors (KYC decisions and revocations, retail limits), Pools (lifecycle board per pool, pool record with the final report CSV `/api/arranger/report/<id>` and manual pilot tools), Settlement (pools at harvest, settlement or closing), Verification (SCAS queue and season attestations), Delivery (elevator receipt for `delivery.receipt`, 12-parameter lab protocol for `delivery.lab`, `src/lib/lab-quality.ts`), Registry (regulator registry, holders, events, CSV at `/api/regulator/export`), Audit, Team (invite with roles, open invitations, members and their roles, the permission matrix) and Settings (fees, treasury, test USDC). Buttons render only with their permission. See [issuance pipeline](../flows/issuance-pipeline.md), [compliance review](../flows/compliance-review.md), [season and harvest](../flows/season-and-harvest.md), [settlement](../flows/settlement.md).
- **Invitations** (`src/lib/workflow/team.ts`): a team manager invites an email with console roles; the token (32 random bytes, base64url) is shown once as a link and only its SHA-256 is stored; 7-day expiry; re-inviting revokes the open invitation. `/invite/<token>` (no referrer, not indexed) shows the roles and the masked email; accepting needs the invited email's sign-in and runs in one transaction with the row locked and a conditional update, so the link works once. Team managers change a member's roles or remove them (last-arranger and `ARRANGER_EMAILS` rules).
- **Notifications.** `NotificationBell` in every app and console header fetches `GET /api/notifications` (unread count, latest 8, own rows only) and marks read with a same-origin `POST`. Events: role granted, document accepted or rejected, KYC decided or revoked, application status changed, pool opened (approved investors), subscription confirmed, refund, redemption, attestation recorded, delivery documents, election, buyback funded, grain claim (`src/lib/workflow/tx-history.ts` for sponsored transactions), and "matures within 7 days" (`notifyOnce` with a dedupe key, computed at most every 5 minutes when a bell loads).
- **Reads.** Server components call a `ChainReader` that uses `program.account.*.all()` with memcmp filters (projects by producer or pool, fields by project, attestations by field or project) and decodes Token-2022 metadata for the Instrument name and symbol. Results are cached in process for 5 seconds, pool and project lists for 15 seconds with the last good list served when a reload fails; every server-sent transaction and every confirmed browser transaction clears the cache (a signature that does not confirm leaves it alone). Holders of a mint come from a Token-2022 program scan, or from the 20 largest accounts where the RPC refuses that scan (public devnet).
- **RPC resilience.** The server and demo `Connection` use `retryingFetch` (`src/lib/chain/rpc-fetch.ts`): 429, 502, 503 and 504 are retried up to 4 times with exponential backoff and jitter, honouring `Retry-After` (capped at 8 s); web3.js's own 429 retry is off. A Helius endpoint can replace the public RPC through `SOLANA_RPC_URL`.
- **User transactions, sponsored gas** ([ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md)). The browser posts intent to `/api/tx/<action>` (`register-project`, `subscribe`, `refund`, `redeem`, `redeem-delivery`, and for the farmer `elect-settlement`, `fund-redemption`, built only for the pool's issuer of record). The server builds a v0 transaction with `accountsStrict`, the gas sponsor (`F2F_SPONSOR_KEYPAIR`) as fee payer and as the program's rent `payer`, and the FeeConfig/treasury accounts when fees are configured; it simulates without signatures and returns either the unsigned transaction or a plain-language error. The wallet only signs (`signTransaction`; Privy `useSignTransaction`). The browser posts the signed transaction to `/api/tx/send`, which runs `validateSponsoredTx` (`src/lib/chain/sponsor.ts`) and only then adds the sponsor's signature and submits with preflight; the browser then posts the signature to `/api/tx/confirm`, which confirms and refreshes reads. Users need no SOL. A program rejection, such as a subscribe from a wallet without KYC, is shown before the wallet opens. `subscribe` is also gated before building: the wallet must be linked to an onboarded investor who accepted the pool's key features document (403 with action `onboarding` or `kfd`; 503 when Postgres is down). After a successful send the server records `tx.<action>` with pool and amount in the audit log for the wallet's owner (the apps' history).
- **Sponsor validator.** The sponsor signs only a message that holds exactly the f2f instructions `/api/tx` builds for the action (`subscribe`; `register_project` + 1 to 4 `register_field`; `refund`/`redeem`, optionally after an idempotent USDC ATA create paid by the sponsor; `redeem_delivery` alone, which creates nothing; `elect_settlement` alone, signed by the wallet for its own pool's terms; `fund_redemption` alone, moving USDC only from the signer's own USDC account; for `subscribe`, `redeem`, `redeem_delivery`, `elect_settlement` and `fund_redemption` the InstrumentTerms account must be the PDA of the instruction's own pool) plus at most one compute unit limit and one price instruction (price capped at 50,000 micro-lamports per CU). It checks: fee payer is the sponsor; exactly two required signatures; no address lookup tables; no other program; the sponsor appears only as fee payer and in the `payer` account; the wallet is the investor/producer; every PDA, ATA, mint and program account is the expected one, including the treasury account. Anything else is a 400 and is never signed. After validation `cosignAndSend` also (a) refuses `register-project` while FeeConfig charges no mint fee (project and field accounts can never be closed, so their rent is pure spend) and when a field's polygon hash was never uploaded, and (b) checks on-chain whether the transaction would create accounts at the sponsor's expense (the Instrument account, the USDC account before refund/redeem, project and fields); such transactions draw on a rent budget of 5 per wallet and 60 in total per hour, which stops close-and-recreate loops. Treasury ATAs are derived with off-curve owners allowed, so a PDA treasury works.
- **Fees in the UI.** The invest panel shows amount, network fee and total, says no SOL is needed and blocks a subscription the wallet cannot pay including the fee. Farmer registration shows the mint fee, the arrangement fee cap and a test-USDC faucet when the wallet cannot pay the fee. The Instrument card has a Fees row (arrangement fee %, farmer's net). The arranger's Fees and treasury page shows FeeConfig, the treasury USDC balance and the sponsor's SOL, and the create-pool form sets the arrangement fee in the same transaction as `create_pool`.
- **Wallets.** Everyone signs in with email through Privy and gets an embedded Solana wallet. Farmers sign with it. Investors sign with it inside the investor app or connect Phantom (wallet adapter, also on the public pool page); a Phantom wallet is linked to the account by a signed message. Without `NEXT_PUBLIC_PRIVY_APP_ID` sign-in says it is not configured.
- **Server-signed actions.** Console server actions and the faucet route sign with keys from the environment: Issuer (pool lifecycle, delivery records for the elevator and laboratory), compliance (`approve_investor`, `revoke_investor` for the KYC decisions), SCAS (stub and partner attestations), deployer (test-USDC mint authority; SOL top-ups only with `FAUCET_SOL=true`), sponsor (fee payer and rent payer for user transactions, co-signs only after validation).
- **Console rules (arranger's live pools).** Every action shows why it is unavailable. "Verify all fields" works before pooling; the season attestations (`Sowing`, `Vegetation`, `Harvest`) open only once the pool is Funded or Redeeming (`seasonAttestationBlocker` in `src/lib/pool-math.ts`, checked again in the server action). Irreversible actions (sweep, revoke) ask for an inline confirmation whose button names the consequence.
- **Term-sheet pools** ([ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md)). The reader attaches InstrumentTerms to `PoolView.terms` (all pools in one `instrumentTerms.all()`) and to `PoolDetail.terms`, plus `issuerKycApproved` from the issuer of record's InvestorRecord. The pool page renders the Instrument card as the term sheet (`components/pool/term-sheet.tsx`): issuer of record with KYC status, instrument type, nominal, number of tokens, issue size, coupon and Act/360 payout per token, settlement status, the 12-parameter quality spec loaded from the bucket by its on-chain hash, volume, tokenized share, elevator, laboratory, and the farmer requirement checklist from the onboarding manifest. Payouts are shown floored to the cent (`formatUsdDown`), never above what the program pays. The invest panel takes whole tokens and totals tokens × nominal plus the network fee; when delivery applies after maturity it offers "Claim N t of grain" (`redeem-delivery`, sponsored, burns only). The portfolio values positions with the coupon (`PositionView.atMaturity`).
- **Live pools for the pilot.** The create-pool form has a "Term sheet instrument" mode: issuer of record from KYC-approved farmers with waiting projects (`ChainReader.approvedWallets`), nominal, coupon, settlement mode, volume, tokenized share, elevator, laboratory and an optional demo interest backdate; the action stores the quality spec JSON in the bucket before `create_pool` + `set_instrument_terms`. Each term-sheet pool gets "5. Term sheet settlement": elect buyback or delivery, and record an elevator receipt or lab certificate (file to `documents/`, evidence JSON to `evidence/`, then `record_delivery`). "Fund redemption" uses the coupon and is disabled once delivery applies. New sections: farmer onboarding checklist (upload per requirement), field import (GeoJSON or KML, MultiPolygons split into fields, cadastral number and declared area per field, more than 5% area difference flagged, saved as a field set), and an arranger-only test-USDC mint up to $5,000,000 for demo investors (the public faucet stays at `FAUCET_USDC`).
- **SCAS stub.** See [ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md) and the [field verification flow](../flows/field-verification.md).

- **Hidden pools.** On-chain pools cannot be deleted. `HIDDEN_POOL_IDS` (comma-separated pool ids) hides test and superseded pools from the home page and `/pools` (`src/lib/listed-pools.ts`). A hidden pool still opens by direct link, still shows in a holder's portfolio and in the console. Since 2026-10-05 only the pilot pool 8 is listed.
- **User transaction compute budget.** `buildV0` prepends its own compute unit limit and price (`src/lib/chain/send.ts`), so wallets do not inject a priority fee above the gas sponsor's cap.

## Important flows

- [Primary subscription](../flows/primary-subscription.md)
- [Field verification](../flows/field-verification.md)
- [Pool lifecycle](../flows/pool-lifecycle.md)
- [Farmer onboarding](../flows/farmer-onboarding.md), [Investor onboarding](../flows/investor-onboarding.md), [Issuance pipeline](../flows/issuance-pipeline.md)
- [Compliance review](../flows/compliance-review.md), [Season and harvest](../flows/season-and-harvest.md), [Settlement](../flows/settlement.md)

## Data and state

- Postgres ([data.md](data.md)): accounts, roles, wallets, profiles, applications, document metadata, KFD acceptances, audit log, notifications. Money, rights, hashes and attestations stay in Program accounts on devnet.
- Bucket `f2f-evidence`: `polygons/<sha256>.json` (canonical field polygons), `evidence/<sha256>.json` (stub evidence, quality specs, delivery evidence), `documents/<sha256>` (farmer documents incl. issuer KYC, elevator receipts, lab certificates; served to arrangers and the uploader only), `fieldsets/<sha256>.json` (imported fields with cadastral numbers and declared areas). Keys are content hashes and those objects never change. The exception is `onboarding/<wallet>.json`, the farmer's checklist (requirement, document hash, size, type, upload time; no names or personal data), rewritten on each upload.
- In-process: the read cache, the SCAS send queue, the faucet cooldown. All reset on restart, which is safe.

## Interfaces and entry points

| Route | Who | Purpose |
| --- | --- | --- |
| every route except `/api/health` | holders of the basic auth credentials | HTTP Basic Auth gate in `src/proxy.ts` ([ADR 0015](../architecture/decisions/0015-basic-auth-on-the-pilot-platform.md)) |
| `/`, `/pools`, `/pools/[poolId]`, `/fields/[address]` | anyone past basic auth | read views |
| `/sign-in` | anyone past basic auth | Privy email sign-in; sends each account home, or shows the two doors |
| `/invest/signup`, `/apply`, `/apply/start` | anyone past basic auth | sign-up doors: investor account, farmer explainer and issuer sign-up |
| `/invite/[token]` | invitee | console invitation: sign in with the invited email, accept |
| `/invest/**` | account kind `investor` | investor app |
| `/issuer/**` | account kind `farmer` | issuer workspace |
| `/console` | any console role | inbox of work queues by permission |
| `/console/{applications,issuers,investors,pools,settlement,verification,delivery,registry,audit,team,settings}/**` | the section's permission (see [permissions](../architecture/decisions/0018-separate-doors-and-permission-based-console.md)) | console sections; server actions with server-held keys |
| `GET /api/session` | public header | `{ signedIn, home }` for the cookie, no user data |
| `GET`/`POST /api/notifications` | any signed-in user | bell: own notifications, mark read (same-origin) |
| `GET /api/regulator/export` | permission `registry.export` | CSV of registry, holders or events |
| `GET /api/arranger/report/[poolId]` | permission `pools.view` | a pool's final report CSV |
| old cabinet URLs (`/arranger/**`, `/compliance/**`, `/scas/**`, `/elevator`, `/regulator/**`, `/farmer/**`, `/investor/**`, `/admin`, `/portfolio`) | anyone | temporary redirects to the console and the apps (`src/lib/redirects.ts`) |
| `POST`/`DELETE /api/session` | browser after Privy login | exchange the Privy token for the session cookie, sign out |
| `GET /api/investor/statement` | account kind `investor` | CSV statement |
| `GET /api/health` | Railway | liveness, no devnet call |
| `POST /api/polygons`, `GET /api/polygons/[hash]` | farmer view, field page | polygon upload and hashed read |
| `GET /api/evidence/[hash]` | anyone past basic auth | stub evidence, quality specs and delivery evidence, hash-checked, `cache-control: private` |
| `GET /api/documents/[hash]` | `documents.view`, `issuers.view` for issuer KYC files, the uploader | farmer documents, service uploads and delivery papers, hash-checked, never cached; 404 to other users |
| `GET /api/instrument/[poolId]` | wallets | Token-2022 metadata URI target |
| `POST /api/tx/[action]`, `POST /api/tx/send`, `POST /api/tx/confirm` | browser | server-built user transactions (`register-project`, `subscribe`, `refund`, `redeem`, `redeem-delivery`, `elect-settlement`, `fund-redemption`), sponsor co-sign and submit, confirmation |
| `POST /api/faucet` | apps, console, pool page | test funds |
| `POST /api/kyc` | none | 410: KYC moved to the investor app |
| `GET /api/producer/[wallet]`, `GET /api/investor/[wallet]` | browser | wallet-scoped reads |

## Dependencies

Solana devnet RPC, the `f2f` Program, `@f2f/sdk`, Railway bucket, Railway Postgres, Privy (client SDK and `@privy-io/server-auth`), GlitchTip (org `personal`, project `f2f-web`), PostHog EU (project id 292588), Esri World Imagery tiles.

Deployment: Railway project `field-to-finance`, environment `production`, service `web` built from `apps/web/Dockerfile` (Next.js standalone output, port 8080, healthcheck `/api/health`, pre-deploy `node apps/web/dist/migrate.mjs`), public URL https://field-to-finance.up.railway.app. Deployed with `railway up --service web` from the repository root; there is no GitHub link and no `railway.json`.

## Downstream effects

Renaming a Program instruction, account field or seed breaks `src/lib/chain/ix.ts`, `views.ts` and `filters.ts`. Changing the polygon normalization in `@f2f/sdk` orphans stored polygons.

## Invariants and assumptions

- Privileged keys are only read in server code (`src/lib/server/*`, route handlers, server actions).
- `register_field` stores the `@f2f/sdk` polygon hash of the uploaded polygon, and the polygon is stored under that hash before the transaction is built.
- Evidence is stored before the Attestation that points at it is sent.
- Stub attestations are serialized per process.
- `PUBLIC_BASE_URL` is at most 50 characters so evidence and metadata URIs fit 128 bytes.

## Error handling

Program and wallet errors go through `explainChainError` into a title, a detail and one way out (`kyc`, `faucet`, `switch-network`, `retry`). Unexpected server errors go to GlitchTip with cookies, auth headers, query strings, request bodies and user data removed.

## Security and privacy notes

- **Basic auth** ([ADR 0015](../architecture/decisions/0015-basic-auth-on-the-pilot-platform.md)). `src/proxy.ts` runs on every request (no matcher: pages, server actions, API routes, static files) and asks for `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`, compared in constant time. Only `/api/health` is public, matched exactly. In production with either variable unset everything else answers 503 (fail closed); outside production unset variables turn the gate off. `BASIC_AUTH=off` turns it off in production too (public since 2026-10-10, user decision); the credentials can stay set and take effect again once the switch is removed. Same-origin browser fetches carry the cached credentials. Wallets and other outside clients cannot read `/api/instrument/<poolId>` or evidence URIs.

- **Accounts** ([ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md)): the session cookie is the Privy access token (httpOnly, SameSite=Lax, Secure in production, expires with the token), verified on every protected request; roles come from Postgres per request. The `ADMIN_PASSWORD` console is removed. `F2F_DEV_AUTH=1` (dev verifier for `dev:<email>` tokens, used for screenshots and scripts) is ignored when `NODE_ENV` is production.
- Farmer documents and delivery papers are served only to arrangers and the uploader. Cadastral numbers live in field sets in the bucket, never on-chain or in the repository. Company profiles, BIN, investor names and countries live in Postgres only ([data.md](data.md#security-and-privacy-notes)).
- Investor mock KYC values are kept in Postgres for the arranger's review; nothing personal is logged or sent to analytics.
- Evidence and polygons are readable by anyone past basic auth. The user approved real pilot farm data behind basic auth (2026-10-05); identifiers (BIN, cadastral numbers, farm name) stay out of the repository.
- The gas sponsor key only co-signs validated user transactions (see above). `/api/tx/send` allows 20 requests per IP per 10 minutes and 300 per hour in total, plus the per-wallet rent budget above (all limiters are in process); preflight keeps failing transactions from costing fees. Each new Instrument, project or field account costs the sponsor rent, so its balance is on the arranger's Fees and treasury page with a low-balance warning.
- The faucet mints only test USDC (SOL top-up off unless `FAUCET_SOL=true`). Limits: 60 s per wallet, 3 requests per IP per 10 minutes, 30 per hour in total. These limits protect the deployer balance from fresh-wallet loops; KYC approvals now come only from an arranger.
- A set but malformed role key fails the server boot (`assertRoleKeys` in `src/instrumentation.ts`), so the Railway healthcheck fails instead of serving a broken console; the arranger's live pools and treasury pages name a missing or malformed key by variable.

## Observability and debugging

- GlitchTip `f2f-web`: `GET /api/0/projects/personal/f2f-web/issues/?query=is:unresolved`.
- PostHog events: `tx_succeeded`, `tx_failed` (with the explained error code), `kyc_approved`, `faucet_used`, `fields_uploaded`, `farmer_login`; person property `app_env`.
- The arranger's live pools and treasury pages warn when a role key in the environment differs from Config, when `F2F_TREASURY` differs from `FeeConfig.treasury`, and when the sponsor is low on SOL.

## Testing notes

`pnpm nx run web:test` runs Vitest (node and jsdom); the data layer and workflows run on PGlite with the committed migrations. Fixtures encode accounts with the real IDL. `pnpm demo` runs the whole flow on devnet; `scripts/demo-lifecycle.ts` walks every party through both settlement paths (service parties join by console invitation) and writes the regulator CSVs (`DEMO_DATABASE_URL`, `DEMO_EXPORT_DIR`, `DEMO_MATURITY_MINUTES`); `scripts/demo-pilot.ts buyback|delivery` runs the pilot term sheet; `scripts/devnet-seed-pilot.ts` opens a standing pilot pool with labelled sample fields; `scripts/demo-cabinets.ts` walks the apps and the console end to end (writes demo accounts to Postgres).

## Common pitfalls

- Phantom on mainnet: transactions fail with "Blockhash not found"; the UI asks to switch to Devnet.
- Privy must sign on `solana:devnet`; otherwise it submits to mainnet.
- `NEXT_PUBLIC_*` variables are build-time; changing them on Railway needs a rebuild.
- Demo Pools need a maturity a few minutes out.
- maplibre-gl 6 starts its worker from a URL Turbopack does not emit; the worker files are copied to `public/maplibre/<version>/` and a test fails when the installed version changes until they are re-copied.
- `@solana-program/memo` is an optional Privy peer that `/farmer` needs at bundle time; `test/privy-deps.test.ts` guards it.
- The UI is dark-only ("Night field" in `.tastemaker/style-lock.md`); colours come from the tokens in `globals.css`, never hex in components. MapLibre paint needs literal colours, kept in `src/lib/map.ts`. `<html>` always carries `.dark`, so components use no `dark:` variants (shadcn's dark alternates would override the tokens); a test guards this. There is no warning colour: caution states are neutral text plus an icon, wheat stays the brand colour.
- Motion: the landing hero intro is CSS (starts with first paint) and plays once per browser session: an inline `<head>` script from `src/lib/intro-seen.ts` sets `html[data-seen]` from sessionStorage before paint, the CSS animates only under `html:not([data-seen])`, and the landing sets the flag after the intro has played so client navigation back to `/` does not replay it; the scroll beats are GSAP ScrollTrigger in `landing-motion.tsx`, the app uses CSS classes. Nothing animates on refetch: row stagger runs on the first data load only (`use-enter-once.ts`), the funding meter animates only on mount. Reduced motion shows end states. The deal path pin needs `pinSpacing: true` because the landing column is a flex container.
- The landing hero image and its outline paths (`hero-visual.tsx`) are generated from `public/samples/demo-fields.geojson`; regenerate both if the sample fields move.

## Source map

- [src/lib/chain/reader.ts](../../apps/web/src/lib/chain/reader.ts) — reads and cache
- [src/lib/chain/ix.ts](../../apps/web/src/lib/chain/ix.ts) — instruction builders
- [src/lib/chain/user-tx.ts](../../apps/web/src/lib/chain/user-tx.ts) — server-built user transactions
- [src/lib/chain/sponsor.ts](../../apps/web/src/lib/chain/sponsor.ts) — sponsor validator and co-sign
- [src/lib/chain/admin-ops.ts](../../apps/web/src/lib/chain/admin-ops.ts) — Issuer and compliance operations
- [src/lib/chain/explain.ts](../../apps/web/src/lib/chain/explain.ts) — plain-language errors
- [src/lib/scas-stub.ts](../../apps/web/src/lib/scas-stub.ts) — SCAS stub
- [src/lib/server/context.ts](../../apps/web/src/lib/server/context.ts) — keys and singletons
- [src/app/console/_actions/pools.ts](../../apps/web/src/app/console/_actions/pools.ts) — pool console actions (each with its permission, audited); [applications.ts](../../apps/web/src/app/console/_actions/applications.ts), [kyc.ts](../../apps/web/src/app/console/_actions/kyc.ts), [team.ts](../../apps/web/src/app/console/_actions/team.ts) — pipeline, KYC and team actions
- [src/lib/auth/session.ts](../../apps/web/src/lib/auth/session.ts), [src/lib/server/auth.ts](../../apps/web/src/lib/server/auth.ts), [src/app/api/session/route.ts](../../apps/web/src/app/api/session/route.ts) — sign-in and role guard
- [src/lib/workflow/](../../apps/web/src/lib/workflow/) — farmer, investor and arranger workflows; [src/lib/application-status.ts](../../apps/web/src/lib/application-status.ts) — status machine
- [src/app/(app)/invest/](../../apps/web/src/app/(app)/invest/), [src/app/(app)/issuer/](../../apps/web/src/app/(app)/issuer/), [src/app/console/](../../apps/web/src/app/console/) (actions in `console/_actions/`), [src/app/(site)/](../../apps/web/src/app/(site)/) — apps, console, public pages and doors
- [src/lib/permissions.ts](../../apps/web/src/lib/permissions.ts), [src/lib/workflow/team.ts](../../apps/web/src/lib/workflow/team.ts), [src/lib/workflow/accounts.ts](../../apps/web/src/lib/workflow/accounts.ts), [src/lib/workflow/inbox.ts](../../apps/web/src/lib/workflow/inbox.ts), [src/lib/redirects.ts](../../apps/web/src/lib/redirects.ts) — permissions, invitations, doors, inbox, old-URL redirects
- [src/lib/lifecycle.ts](../../apps/web/src/lib/lifecycle.ts), [src/lib/lab-quality.ts](../../apps/web/src/lib/lab-quality.ts), [src/lib/chain/rpc-fetch.ts](../../apps/web/src/lib/chain/rpc-fetch.ts) — lifecycle board, lab evaluation, RPC retry
- [src/lib/demo/lifecycle-flow.ts](../../apps/web/src/lib/demo/lifecycle-flow.ts) — devnet walk of both settlement paths (`scripts/demo-lifecycle.ts`)
- [src/lib/demo/main-flow.ts](../../apps/web/src/lib/demo/main-flow.ts) — end-to-end script; [pilot-flow.ts](../../apps/web/src/lib/demo/pilot-flow.ts) — pilot term sheet, buyback and delivery; [context.ts](../../apps/web/src/lib/demo/context.ts) — shared devnet setup
- [src/lib/instrument-terms.ts](../../apps/web/src/lib/instrument-terms.ts), [src/components/pool/term-sheet.tsx](../../apps/web/src/components/pool/term-sheet.tsx) — term-sheet presentation
- [src/lib/pilot-docs.ts](../../apps/web/src/lib/pilot-docs.ts), [src/lib/field-import.ts](../../apps/web/src/lib/field-import.ts) — bucket documents, onboarding, field import
- [src/components/admin/term-sheet-console.tsx](../../apps/web/src/components/admin/term-sheet-console.tsx) — election and delivery documents
- [src/app/globals.css](../../apps/web/src/app/globals.css) — theme tokens and CSS motion
- [src/components/landing/landing-motion.tsx](../../apps/web/src/components/landing/landing-motion.tsx) — landing scroll choreography

## Related docs

- [Program](program.md), [Data](data.md), [Cabinets redesign spec](../specs/2026-10-07-cabinets-redesign.md), [ADR 0018](../architecture/decisions/0018-separate-doors-and-permission-based-console.md), [Role cabinets spec](../specs/2026-10-05-role-cabinets.md), [Complete platform spec](../specs/2026-10-05-platform-complete.md), [ADR 0017](../architecture/decisions/0017-service-role-cabinets.md), [ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md), [MVP design](../specs/2026-10-03-mvp-design.md), [ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md), [ADR 0015](../architecture/decisions/0015-basic-auth-on-the-pilot-platform.md), [ADR 0005](../architecture/decisions/0005-wallet-model.md), [ADR 0011](../architecture/decisions/0011-platform-level-kyc.md), [ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md), [ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md)

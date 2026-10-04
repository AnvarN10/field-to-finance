# Web app

## Purpose

`apps/web` is the only deployed service. It shows Pools, Fields and Attestations from devnet, lets Producers register fields and investors subscribe with their own wallets, and runs the demo console where server-held keys act as Issuer, compliance and the SCAS stub.

## Questions this doc answers

- Where do privileged keys live and who can use them?
- How does a user transaction get built, signed and confirmed?
- How are reads cached and when are they refreshed?
- What does the SCAS stub write and sign?

## Scope

Pages, route handlers, server actions, the read layer over Program accounts, server-built transactions, the SCAS stub, polygon and evidence storage, the test-USDC faucet, mock KYC, GlitchTip and PostHog.

## Non-scope

- Program rules: see [program.md](program.md).
- Real KYC, the fiat on-ramp and a real SCAS provider.

## Key concepts

Pool, Instrument, Farm Project, Field, Attestation, KYC Thaw, Shortfall. See the [glossary](../glossary.md).

## How the system works

- **Reads.** Server components call a `ChainReader` that uses `program.account.*.all()` with memcmp filters (projects by producer or pool, fields by project, attestations by field) and decodes Token-2022 metadata for the Instrument name and symbol. Results are cached in process for 5 seconds; every server-sent transaction and every confirmed browser transaction clears the cache (a signature that does not confirm leaves it alone).
- **User transactions, sponsored gas** ([ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md)). The browser posts intent to `/api/tx/<action>` (`register-project`, `subscribe`, `refund`, `redeem`). The server builds a v0 transaction with `accountsStrict`, the gas sponsor (`F2F_SPONSOR_KEYPAIR`) as fee payer and as the program's rent `payer`, and the FeeConfig/treasury accounts when fees are configured; it simulates without signatures and returns either the unsigned transaction or a plain-language error. The wallet only signs (`signTransaction`; Privy `useSignTransaction`). The browser posts the signed transaction to `/api/tx/send`, which runs `validateSponsoredTx` (`src/lib/chain/sponsor.ts`) and only then adds the sponsor's signature and submits with preflight; the browser then posts the signature to `/api/tx/confirm`, which confirms and refreshes reads. Users need no SOL. A program rejection, such as a subscribe from a wallet without KYC, is shown before the wallet opens.
- **Sponsor validator.** The sponsor signs only a message that holds exactly the f2f instructions `/api/tx` builds for the action (`subscribe`; `register_project` + 1 to 4 `register_field`; `refund`/`redeem`, optionally after an idempotent USDC ATA create paid by the sponsor; `redeem_delivery` alone, which creates nothing; for `subscribe`, `redeem` and `redeem_delivery` the InstrumentTerms account must be the PDA of the instruction's own pool) plus at most one compute unit limit and one price instruction (price capped at 50,000 micro-lamports per CU). It checks: fee payer is the sponsor; exactly two required signatures; no address lookup tables; no other program; the sponsor appears only as fee payer and in the `payer` account; the wallet is the investor/producer; every PDA, ATA, mint and program account is the expected one, including the treasury account. Anything else is a 400 and is never signed. After validation `cosignAndSend` also (a) refuses `register-project` while FeeConfig charges no mint fee (project and field accounts can never be closed, so their rent is pure spend) and when a field's polygon hash was never uploaded, and (b) checks on-chain whether the transaction would create accounts at the sponsor's expense (the Instrument account, the USDC account before refund/redeem, project and fields); such transactions draw on a rent budget of 5 per wallet and 60 in total per hour, which stops close-and-recreate loops. Treasury ATAs are derived with off-curve owners allowed, so a PDA treasury works.
- **Fees in the UI.** The invest panel shows amount, network fee and total, says no SOL is needed and blocks a subscription the wallet cannot pay including the fee. Farmer registration shows the mint fee, the arrangement fee cap and a test-USDC faucet when the wallet cannot pay the fee. The Instrument card has a Fees row (arrangement fee %, farmer's net). The admin console shows FeeConfig, the treasury USDC balance and the sponsor's SOL, and the create-pool form sets the arrangement fee in the same transaction as `create_pool`.
- **Wallets.** Investors use the Solana wallet adapter (Phantom and other Wallet Standard wallets). Producers sign in with email through Privy and get an embedded Solana wallet; without `NEXT_PUBLIC_PRIVY_APP_ID` the farmer view falls back to the wallet adapter.
- **Server-signed actions.** Admin server actions and the KYC and faucet routes sign with keys from the environment: Issuer (pool lifecycle), compliance (`approve_investor`, `revoke_investor`), SCAS (stub attestations), deployer (test-USDC mint authority; SOL top-ups only with `FAUCET_SOL=true`), sponsor (fee payer and rent payer for user transactions, co-signs only after validation).
- **Admin console rules.** Every action shows why it is unavailable. "Verify all fields" works before pooling; the season attestations (`Sowing`, `Vegetation`, `Harvest`) open only once the pool is Funded or Redeeming (`seasonAttestationBlocker` in `src/lib/pool-math.ts`, checked again in the server action). Irreversible actions (sweep, revoke) ask for an inline confirmation whose button names the consequence.
- **Term-sheet pools** ([ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md)). The reader attaches InstrumentTerms to `PoolView.terms` (all pools in one `instrumentTerms.all()`) and to `PoolDetail.terms`, plus `issuerKycApproved` from the issuer of record's InvestorRecord. The pool page renders the Instrument card as the term sheet (`components/pool/term-sheet.tsx`): issuer of record with KYC status, instrument type, nominal, number of tokens, issue size, coupon and Act/360 payout per token, settlement status, the 12-parameter quality spec loaded from the bucket by its on-chain hash, volume, tokenized share, elevator, laboratory, and the farmer requirement checklist from the onboarding manifest. Payouts are shown floored to the cent (`formatUsdDown`), never above what the program pays. The invest panel takes whole tokens and totals tokens × nominal plus the network fee; when delivery applies after maturity it offers "Claim N t of grain" (`redeem-delivery`, sponsored, burns only). The portfolio values positions with the coupon (`PositionView.atMaturity`).
- **Admin console for the pilot.** The create-pool form has a "Term sheet instrument" mode: issuer of record from KYC-approved farmers with waiting projects (`ChainReader.approvedWallets`), nominal, coupon, settlement mode, volume, tokenized share, elevator, laboratory and an optional demo interest backdate; the action stores the quality spec JSON in the bucket before `create_pool` + `set_instrument_terms`. Each term-sheet pool gets "5. Term sheet settlement": elect buyback or delivery, and record an elevator receipt or lab certificate (file to `documents/`, evidence JSON to `evidence/`, then `record_delivery`). "Fund redemption" uses the coupon and is disabled once delivery applies. New sections: farmer onboarding checklist (upload per requirement), field import (GeoJSON or KML, MultiPolygons split into fields, cadastral number and declared area per field, more than 5% area difference flagged, saved as a field set), and an admin-only test-USDC mint up to $5,000,000 for demo investors (the public faucet stays at `FAUCET_USDC`).
- **SCAS stub.** See [ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md) and the [field verification flow](../flows/field-verification.md).

## Important flows

- [Primary subscription](../flows/primary-subscription.md)
- [Field verification](../flows/field-verification.md)
- [Pool lifecycle](../flows/pool-lifecycle.md)

## Data and state

- No database. State is Program accounts on devnet.
- Bucket `f2f-evidence`: `polygons/<sha256>.json` (canonical field polygons), `evidence/<sha256>.json` (stub evidence, quality specs, delivery evidence), `documents/<sha256>` (farmer documents, elevator receipts, lab certificates; admin-only), `fieldsets/<sha256>.json` (imported fields with cadastral numbers and declared areas). Keys are content hashes and those objects never change. The exception is `onboarding/<wallet>.json`, the farmer's checklist (requirement, document hash, size, type, upload time; no names or personal data), rewritten on each upload.
- In-process: the read cache, the SCAS send queue, the faucet cooldown. All reset on restart, which is safe.

## Interfaces and entry points

| Route | Who | Purpose |
| --- | --- | --- |
| every route except `/api/health` | holders of the basic auth credentials | HTTP Basic Auth gate in `src/proxy.ts` ([ADR 0015](../architecture/decisions/0015-basic-auth-on-the-pilot-platform.md)) |
| `/`, `/pools`, `/pools/[poolId]`, `/fields/[address]` | anyone past basic auth | read views |
| `/farmer`, `/portfolio` | Producer, investor | write flows signed in the browser |
| `/admin`, `/admin/login` | demo operator | server actions with server-held keys |
| `GET /api/health` | Railway | liveness, no devnet call |
| `POST /api/polygons`, `GET /api/polygons/[hash]` | farmer view, field page | polygon upload and hashed read |
| `GET /api/evidence/[hash]` | anyone past basic auth | stub evidence, quality specs and delivery evidence, hash-checked, `cache-control: private` |
| `GET /api/documents/[hash]` | admin session | farmer documents and delivery papers, hash-checked, never cached |
| `GET /api/instrument/[poolId]` | wallets | Token-2022 metadata URI target |
| `POST /api/tx/[action]`, `POST /api/tx/send`, `POST /api/tx/confirm` | browser | server-built user transactions (`register-project`, `subscribe`, `refund`, `redeem`, `redeem-delivery`), sponsor co-sign and submit, confirmation |
| `POST /api/kyc`, `POST /api/faucet` | investor and farmer views | mock KYC approval, test funds |
| `GET /api/producer/[wallet]`, `GET /api/investor/[wallet]` | browser | wallet-scoped reads |

## Dependencies

Solana devnet RPC, the `f2f` Program, `@f2f/sdk`, Railway bucket, Privy, GlitchTip (org `personal`, project `f2f-web`), PostHog EU (project id 292588), Esri World Imagery tiles.

Deployment: Railway project `field-to-finance`, environment `production`, service `web` built from `apps/web/Dockerfile` (Next.js standalone output, port 8080, healthcheck `/api/health`), public URL https://field-to-finance.up.railway.app. Deployed with `railway up --service web` from the repository root; there is no GitHub link and no `railway.json`.

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

- **Basic auth** ([ADR 0015](../architecture/decisions/0015-basic-auth-on-the-pilot-platform.md)). `src/proxy.ts` runs on every request (no matcher: pages, server actions, API routes, static files) and asks for `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`, compared in constant time. Only `/api/health` is public, matched exactly. In production with either variable unset everything else answers 503 (fail closed); outside production unset variables turn the gate off. Same-origin browser fetches carry the cached credentials. Wallets and other outside clients cannot read `/api/instrument/<poolId>` or evidence URIs.

- The demo console is protected by `ADMIN_PASSWORD` (HMAC session cookie, httpOnly, SameSite strict). It is a demo control, not production auth.
- Farmer documents and delivery papers are served only to an admin session; the pages show their hashes and status. Cadastral numbers live in field sets in the bucket and the admin's input, never on-chain or in the repository.
- Mock KYC values are validated and discarded; nothing personal is stored, logged or sent to analytics.
- Evidence and polygons are readable by anyone past basic auth. The user approved real pilot farm data behind basic auth (2026-10-05); identifiers (BIN, cadastral numbers, farm name) stay out of the repository.
- The gas sponsor key only co-signs validated user transactions (see above). `/api/tx/send` allows 20 requests per IP per 10 minutes and 300 per hour in total, plus the per-wallet rent budget above (all limiters are in process); preflight keeps failing transactions from costing fees. Each new Instrument, project or field account costs the sponsor rent, so its balance is on the admin console with a low-balance warning.
- The faucet mints only test USDC (SOL top-up off unless `FAUCET_SOL=true`). Limits: 60 s per wallet, 3 requests per IP per 10 minutes, 30 per hour in total. Mock KYC: 5 approvals per IP per 10 minutes, 60 per hour in total, and an already approved wallet costs nothing. Both protect the deployer and compliance balances from fresh-wallet loops.
- A set but malformed role key fails the server boot (`assertRoleKeys` in `src/instrumentation.ts`), so the Railway healthcheck fails instead of serving a broken console; the admin console names a missing or malformed key by variable.

## Observability and debugging

- GlitchTip `f2f-web`: `GET /api/0/projects/personal/f2f-web/issues/?query=is:unresolved`.
- PostHog events: `tx_succeeded`, `tx_failed` (with the explained error code), `kyc_approved`, `faucet_used`, `fields_uploaded`, `farmer_login`; person property `app_env`.
- The admin console warns when a role key in the environment differs from Config, when `F2F_TREASURY` differs from `FeeConfig.treasury`, and when the sponsor is low on SOL.

## Testing notes

`pnpm nx run web:test` runs Vitest (node and jsdom). Fixtures encode accounts with the real IDL. `pnpm demo` runs the whole flow on devnet; `scripts/demo-pilot.ts buyback|delivery` runs the pilot term sheet; `scripts/devnet-seed-pilot.ts` opens a standing pilot pool with labelled sample fields.

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
- [src/app/admin/actions.ts](../../apps/web/src/app/admin/actions.ts) — demo console actions
- [src/lib/demo/main-flow.ts](../../apps/web/src/lib/demo/main-flow.ts) — end-to-end script; [pilot-flow.ts](../../apps/web/src/lib/demo/pilot-flow.ts) — pilot term sheet, buyback and delivery; [context.ts](../../apps/web/src/lib/demo/context.ts) — shared devnet setup
- [src/lib/instrument-terms.ts](../../apps/web/src/lib/instrument-terms.ts), [src/components/pool/term-sheet.tsx](../../apps/web/src/components/pool/term-sheet.tsx) — term-sheet presentation
- [src/lib/pilot-docs.ts](../../apps/web/src/lib/pilot-docs.ts), [src/lib/field-import.ts](../../apps/web/src/lib/field-import.ts) — bucket documents, onboarding, field import
- [src/components/admin/term-sheet-console.tsx](../../apps/web/src/components/admin/term-sheet-console.tsx) — election and delivery documents
- [src/app/globals.css](../../apps/web/src/app/globals.css) — theme tokens and CSS motion
- [src/components/landing/landing-motion.tsx](../../apps/web/src/components/landing/landing-motion.tsx) — landing scroll choreography

## Related docs

- [Program](program.md), [MVP design](../specs/2026-10-03-mvp-design.md), [ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md), [ADR 0015](../architecture/decisions/0015-basic-auth-on-the-pilot-platform.md), [ADR 0005](../architecture/decisions/0005-wallet-model.md), [ADR 0011](../architecture/decisions/0011-platform-level-kyc.md), [ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md), [ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md)

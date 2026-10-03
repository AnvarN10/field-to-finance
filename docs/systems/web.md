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
- **User transactions.** The browser posts intent to `/api/tx/<action>` (`register-project`, `subscribe`, `refund`, `redeem`). The server builds a v0 transaction with `accountsStrict`, simulates it without signatures, and returns either the unsigned transaction or a plain-language error. The wallet signs and sends; the browser posts the signature to `/api/tx/confirm`, which confirms on the server's RPC and refreshes reads. A program rejection, such as a subscribe from a wallet without KYC, is shown before the wallet opens.
- **Wallets.** Investors use the Solana wallet adapter (Phantom and other Wallet Standard wallets). Producers sign in with email through Privy and get an embedded Solana wallet; without `NEXT_PUBLIC_PRIVY_APP_ID` the farmer view falls back to the wallet adapter.
- **Server-signed actions.** Admin server actions and the KYC and faucet routes sign with keys from the environment: Issuer (pool lifecycle), compliance (`approve_investor`, `revoke_investor`), SCAS (stub attestations), deployer (test-USDC mint authority, SOL top-ups).
- **Admin console rules.** Every action shows why it is unavailable. "Verify all fields" works before pooling; the season attestations (`Sowing`, `Vegetation`, `Harvest`) open only once the pool is Funded or Redeeming (`seasonAttestationBlocker` in `src/lib/pool-math.ts`, checked again in the server action). Irreversible actions (sweep, revoke) ask for an inline confirmation whose button names the consequence.
- **SCAS stub.** See [ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md) and the [field verification flow](../flows/field-verification.md).

## Important flows

- [Primary subscription](../flows/primary-subscription.md)
- [Field verification](../flows/field-verification.md)
- [Pool lifecycle](../flows/pool-lifecycle.md)

## Data and state

- No database. State is Program accounts on devnet.
- Bucket `f2f-evidence`: `polygons/<sha256>.json` (canonical field polygons) and `evidence/<sha256>.json` (stub evidence). Keys are content hashes; objects never change.
- In-process: the read cache, the SCAS send queue, the faucet cooldown. All reset on restart, which is safe.

## Interfaces and entry points

| Route | Who | Purpose |
| --- | --- | --- |
| `/`, `/pools`, `/pools/[poolId]`, `/fields/[address]` | public | read views |
| `/farmer`, `/portfolio` | Producer, investor | write flows signed in the browser |
| `/admin`, `/admin/login` | demo operator | server actions with server-held keys |
| `GET /api/health` | Railway | liveness, no devnet call |
| `POST /api/polygons`, `GET /api/polygons/[hash]` | farmer view, field page | polygon upload and hashed read |
| `GET /api/evidence/[hash]` | anyone | stub evidence, hash-checked |
| `GET /api/instrument/[poolId]` | wallets | Token-2022 metadata URI target |
| `POST /api/tx/[action]`, `POST /api/tx/confirm` | browser | server-built user transactions |
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

- The demo console is protected by `ADMIN_PASSWORD` (HMAC session cookie, httpOnly, SameSite strict). It is a demo control, not production auth.
- Mock KYC values are validated and discarded; nothing personal is stored, logged or sent to analytics.
- Evidence and polygons are public. Do not upload real pilot contours without the farmers' consent.
- The faucet mints only test USDC. Limits: 60 s per wallet, 3 requests per IP per 10 minutes, 30 per hour in total. Mock KYC: 5 approvals per IP per 10 minutes, 60 per hour in total, and an already approved wallet costs nothing. Both protect the deployer and compliance balances from fresh-wallet loops.
- A set but malformed role key fails the server boot (`assertRoleKeys` in `src/instrumentation.ts`), so the Railway healthcheck fails instead of serving a broken console; the admin console names a missing or malformed key by variable.

## Observability and debugging

- GlitchTip `f2f-web`: `GET /api/0/projects/personal/f2f-web/issues/?query=is:unresolved`.
- PostHog events: `tx_succeeded`, `tx_failed` (with the explained error code), `kyc_approved`, `faucet_used`, `fields_uploaded`, `farmer_login`; person property `app_env`.
- The admin console warns when a role key in the environment differs from Config.

## Testing notes

`pnpm nx run web:test` runs Vitest (node and jsdom). Fixtures encode accounts with the real IDL. `pnpm demo` runs the whole flow on devnet.

## Common pitfalls

- Phantom on mainnet: transactions fail with "Blockhash not found"; the UI asks to switch to Devnet.
- Privy must sign on `solana:devnet`; otherwise it submits to mainnet.
- `NEXT_PUBLIC_*` variables are build-time; changing them on Railway needs a rebuild.
- Demo Pools need a maturity a few minutes out.
- maplibre-gl 6 starts its worker from a URL Turbopack does not emit; the worker files are copied to `public/maplibre/<version>/` and a test fails when the installed version changes until they are re-copied.
- `@solana-program/memo` is an optional Privy peer that `/farmer` needs at bundle time; `test/privy-deps.test.ts` guards it.

## Source map

- [src/lib/chain/reader.ts](../../apps/web/src/lib/chain/reader.ts) — reads and cache
- [src/lib/chain/ix.ts](../../apps/web/src/lib/chain/ix.ts) — instruction builders
- [src/lib/chain/user-tx.ts](../../apps/web/src/lib/chain/user-tx.ts) — server-built user transactions
- [src/lib/chain/admin-ops.ts](../../apps/web/src/lib/chain/admin-ops.ts) — Issuer and compliance operations
- [src/lib/chain/explain.ts](../../apps/web/src/lib/chain/explain.ts) — plain-language errors
- [src/lib/scas-stub.ts](../../apps/web/src/lib/scas-stub.ts) — SCAS stub
- [src/lib/server/context.ts](../../apps/web/src/lib/server/context.ts) — keys and singletons
- [src/app/admin/actions.ts](../../apps/web/src/app/admin/actions.ts) — demo console actions
- [src/lib/demo/main-flow.ts](../../apps/web/src/lib/demo/main-flow.ts) — end-to-end script

## Related docs

- [Program](program.md), [MVP design](../specs/2026-10-03-mvp-design.md), [ADR 0005](../architecture/decisions/0005-wallet-model.md), [ADR 0011](../architecture/decisions/0011-platform-level-kyc.md), [ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md)

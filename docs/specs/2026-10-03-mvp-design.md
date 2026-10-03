# Field-to-Finance MVP design

Status: draft for review, 2026-10-03. Deadline: 2026-10-12 23:59 PT.

## 1. Goal and success criteria

Build a working devnet demo that a judge can follow in three minutes: a real pilot field is verified from Sentinel-2 imagery, the verification lands on Solana as a signed Attestation, a Pool is funded by KYC-approved investors in USDC, money reaches the Producer, and the Pool settles with a Shortfall rule applied.

The demo is successful when:

1. Every step of the story runs on devnet against the deployed Program, with explorer links.
2. NDVI numbers come from real Sentinel-2 data for real pilot field contours.
3. A wallet without KYC cannot receive the Instrument, and the demo shows this failing.
4. The repo has program tests for every instruction, including the failure cases listed below.
5. Pitch video, demo video, logo and go-to-market plan are submitted in English before the deadline.

## 2. Positioning for the pitch

- Lead with the real pilot: farmers and a contracted payment on-ramp, both with letters of intent.
- Present field verification as an oracle: Attestations are public accounts that any lender or insurer can read, not a feature locked inside our marketplace.
- Differentiate from TerraLedger, a Frontier 2026 entry from Kazakhstan with NDVI certificates on Token-2022 that did not place. Our differences: a funded instrument with investors and settlement, Shortfall rules that protect investors, real pilot partners, and Attestations across the whole season rather than one certificate.

## 3. Scope

In scope, per [ADR 0007](../architecture/decisions/0007-program-replaces-exchange-clearing-registrar.md):

- Producer registers a Farm Project with Fields.
- SCAS verifies Fields and attests through the season.
- Issuer creates a Pool, adds verified Farm Projects, opens subscription, disburses, records settlement, funds redemption.
- Compliance approves an investor, which thaws the investor's token account.
- Investor subscribes with USDC and redeems after maturity.
- Refund if the Pool does not reach its target.

Out of scope: Secondary Market, regulator and system admin views, a real KYC provider, the fiat on-ramp integration, mainnet, grain logistics.

## 4. Architecture

```
apps/web            Next.js app: farmer, investor, admin views
apps/scas-worker    TypeScript service: Sentinel-2 statistics, evidence, Attestations
programs/f2f        Anchor program
packages/sdk        generated Anchor client, PDA helpers, shared domain types
```

Nx manages the workspace ([ADR 0001](../architecture/decisions/0001-nx-monorepo.md)). The Anchor build runs as an Nx `run-commands` target.

There is no application database. State lives in Program accounts; evidence lives in object storage addressed by its SHA-256 hash.

### 4.1 Program accounts

| Account | Seeds | Key fields |
| --- | --- | --- |
| Config | `config` | admin, scas authority, compliance authority, USDC mint |
| Pool | `pool`, issuer, pool id | crop, season, Instrument mint, USDC vault, target and raised amounts, fixed yield bps, premium bps, subscription close time, maturity time, status |
| FarmProject | `project`, pool, producer | expected tonnes, tokenized tonnes, requested USDC, disbursed flag, settlement rule |
| Field | `field`, project, index | polygon hash, area in hectares × 100, verified flag |
| Attestation | `attestation`, field, sequence | kind, evidence hash, evidence URI, NDVI mean × 10 000, scene date, verdict, signer |
| InvestorRecord | `investor`, wallet | approved flag, approved at. No personal data on-chain. |

Pool status: `Draft`, `Open`, `Funded`, `Refunding`, `Redeeming`. Attestation kind: `FieldVerified`, `Sowing`, `Vegetation`, `Harvest`. Verdict: `Pass`, `Fail`, `InsufficientData`. Settlement rule: `Delivered`, `CoveredFromOtherFields`, `BoughtOnMarket`, `CashRepaidWithPremium`.

### 4.2 Instrument mint

One Token-2022 mint per Pool ([ADR 0003](../architecture/decisions/0003-token-2022-frozen-accounts-kyc-thaw.md)):

- Extensions: Default Account State set to frozen, Metadata Pointer and Token Metadata with name and symbol such as `WHEAT-2027`, so wallets display it.
- Mint and freeze authority: the Pool PDA.
- 6 decimals. One Instrument unit has a face value of one USDC.

### 4.3 Instructions

| Instruction | Signer | Effect |
| --- | --- | --- |
| `init_config` | admin | Creates Config. |
| `register_project` | Producer | Creates FarmProject and its Fields. Tokenized tonnes are set to 30% of expected tonnes by the Program. |
| `record_attestation` | SCAS authority | Creates an Attestation. A `FieldVerified` with `Pass` sets the Field's verified flag. |
| `create_pool` | Issuer | Creates Pool and Instrument mint. Rejects premium outside 500–600 bps. |
| `add_project` | Issuer | Adds a FarmProject. Requires every Field verified. Adds requested USDC to the target. |
| `open_pool` | Issuer | `Draft` to `Open`. |
| `approve_investor` | compliance authority | Sets InvestorRecord approved and thaws the investor's Instrument token account. |
| `subscribe` | Investor | Moves USDC to the Pool vault and mints the same amount of Instrument in one transaction. Requires `Open`, before close time, and not above target. |
| `close_subscription` | anyone | After close time or at target: `Funded` if raised equals target, else `Refunding`. |
| `disburse` | Issuer | Pays each FarmProject's requested USDC from the vault to its Producer. Requires `Funded`. |
| `refund` | Investor | Burns Instrument and returns USDC. Requires `Refunding`. |
| `record_settlement` | Issuer | Stores the Shortfall rule for a FarmProject after a `Harvest` Attestation exists. |
| `fund_redemption` | Issuer | Deposits USDC into the vault. Requires `Funded`. When the vault holds principal plus fixed yield for all outstanding Instrument and maturity has passed, the Pool moves to `Redeeming`. |
| `redeem` | Investor | Burns Instrument and pays principal plus fixed yield. Requires `Redeeming`. |

The fixed yield is the same for every investor whichever Shortfall rule applied ([ADR 0006](../architecture/decisions/0006-pooled-instrument-and-shortfall-rules.md)). How the Producer repays the Issuer happens off-chain and is only recorded by `record_settlement`.

### 4.4 SCAS worker

- Data source: Sentinel Hub Statistical API on the Copernicus Data Space Ecosystem. It returns NDVI statistics for a polygon over a date range, so the worker processes no rasters. Credentials live in Infisical.
- Cloud handling: scenes with more than 30% cloud cover over the polygon are skipped. No usable scene in the window gives an `InsufficientData` Attestation.
- Evidence: a JSON document with the polygon, the request, the response, scene dates and the computed verdict. Stored in object storage under its SHA-256 hash; the hash and URI go on-chain.
- Verdict rules for the demo:
  - `FieldVerified`: the polygon is valid, its area matches the declared area within 5%, and at least one clear scene exists in the last 90 days.
  - `Vegetation`: NDVI mean in the expected range for the crop and date.
- Interface: a CLI for scripted demo runs and an HTTP endpoint the admin view calls. Both sign with the SCAS key.

**Season timing.** Spring 2027 sowing has not happened, so `Sowing`, `Vegetation` and `Harvest` cannot be real for the 2027 season. The demo replays the same fields' 2026 season from historical imagery, clearly labelled in the UI as a replay of last season. `FieldVerified` uses current imagery.

### 4.5 Web app

- **Landing and pools list.** What Field-to-Finance does, open Pools.
- **Pool page.** The Instrument card from the business context: Issuer, Farm Projects, SCAS checks, amount, term, fixed yield, Shortfall rules, risks, status.
- **Field page.** Map with the polygon over satellite imagery, NDVI chart over the season, list of Attestations with explorer links and evidence downloads.
- **Farmer view.** Email login with an embedded wallet ([ADR 0005](../architecture/decisions/0005-wallet-model.md)), register fields from GeoJSON, see financing status.
- **Investor view.** Connect Phantom, submit a mock KYC form, subscribe, portfolio, redeem.
- **Admin view.** Issuer, compliance and SCAS actions behind their keys. Demo-only; keys stay on the server.
- Amounts are shown in USD ([ADR 0004](../architecture/decisions/0004-usdc-settlement-usd-display.md)).

## 5. Main flow

1. Producer registers a Farm Project with two pilot fields.
2. SCAS runs `FieldVerified` for both; Attestations land on-chain.
3. Issuer creates `WHEAT-2027`, adds the project, opens the Pool.
4. Investor without KYC tries to subscribe and fails. Compliance approves; the account thaws; the investor subscribes.
5. Pool is funded; Issuer disburses USDC to the Producer.
6. SCAS replays last season: `Sowing`, `Vegetation`, `Harvest` Attestations.
7. Issuer records settlement `CoveredFromOtherFields`, funds redemption; investor redeems principal plus yield.

## 6. Error handling

- Under-subscription: Pool goes to `Refunding`; investors refund.
- Failed or missing Attestation: `add_project` rejects unverified Fields; `record_settlement` rejects a project without a `Harvest` Attestation.
- Satellite API errors: the worker retries with backoff and never signs an Attestation from a failed request.
- Signer checks: every instruction checks its role key from Config or the Pool.
- Errors are reported to GlitchTip, organization `personal`.

## 7. Testing

- Program tests in TypeScript with LiteSVM for every instruction, including these failures:
  - transfer or subscribe to a frozen, non-approved account;
  - premium outside 500–600 bps;
  - `add_project` with an unverified Field;
  - `subscribe` above target or after close;
  - `disburse` before `Funded`, `redeem` before `Redeeming`;
  - wrong signer for each role.
- Worker tests with recorded Statistical API responses: clear scene, cloudy scene, no scenes, area mismatch.
- One end-to-end devnet script that runs the main flow and prints explorer links. It doubles as the demo video script.

## 8. Schedule

| Date | Work |
| --- | --- |
| Oct 3 | Spec, plan, Nx workspace |
| Oct 4–6 | Program and tests |
| Oct 5–7 | SCAS worker with real pilot contours |
| Oct 6–9 | Web app |
| Oct 9–10 | Devnet deploy, end-to-end script, fixes |
| Oct 11 | Pitch and demo videos, logo, go-to-market plan |
| Oct 12 | Submit; grant repo access to hackathon@colosseum.com |

Secondary Market work starts only if the main flow is done by Oct 9.

## 9. Inputs needed from the team

- Contours of one or two pilot fields as GeoJSON or cadastral numbers, with crop and expected yield.
- Letters of intent from the payment on-ramp and the farmers.
- Names and backgrounds of the three or more team members; all must register on Colosseum before the deadline.
- Copernicus Data Space Ecosystem account for the Statistical API.

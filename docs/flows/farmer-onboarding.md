# Farmer onboarding

## Purpose

A farmer company becomes the issuer of record of its own pool ([ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md)). Before an arranger can structure a pool, the company needs a profile, issuer KYC recorded on-chain for its wallet, the term sheet's documents and registered fields.

## Trigger

A farmer opens `/sign-in`, signs in with email and chooses "I am a farmer".

## Participants

Farmer (browser, Privy email login and embedded Solana wallet), web app (`/farmer` cabinet, `app/farmer/actions.ts`, `/api/tx/register-project`), Postgres, the bucket, the gas sponsor, an arranger (KYC decision, compliance key on the server), the Program.

## Step-by-step flow

1. Sign-in: Privy verifies the email with a one-time code and creates the embedded Solana wallet. `POST /api/session` verifies the token, creates the account and records the embedded wallet. The farmer chooses "I am a farmer" (`chooseRole`).
2. Company profile (`/farmer/onboarding`): legal name, BIN (12 digits), region, contact. Stored in `farmer_profiles`.
3. Issuer KYC: the farmer uploads the charter and director ID; the file goes to the bucket under its SHA-256 and a `documents` row of kind `kyc`; KYC becomes `pending`.
4. Application (`/farmer/applications/new`): crop, grade, season, volume, tokenized share (at most 30%), requested amount, proposed coupon, elevator and laboratory (at most 32 characters each, the program's limits).
5. Documents: one per requirement (insurance; land-use act and cadastral numbers; financial statements; encumbrance certificate; historical yields; field imagery), each with status Missing, In review, Accepted or Rejected.
6. Fields: the farmer uploads a GeoJSON or KML export (MultiPolygons split into fields), checks the declared area and may add the cadastral number per field, and signs the sponsored `register_project` with the Privy wallet (mint fee in test USDC, faucet offered). The server reads the project's producer from the chain, checks it is one of the farmer's wallets and links the project to the application; names and cadastral numbers go to a field set in the bucket.
7. Submit: allowed with a complete profile, every required document uploaded (none rejected) and the project linked. Status `submitted`.
8. The arranger decides issuer KYC during the pipeline's KYC step ([issuance pipeline](issuance-pipeline.md)): approval signs `approve_investor` for the farmer's wallet with the compliance key, then sets the profile to `approved`.

## Data and state changes

`users`, `user_roles`, `wallets`, `farmer_profiles`, `applications`, `documents`, `audit_log`, `notifications`; bucket objects `documents/<sha256>`, `polygons/<sha256>.json`, `fieldsets/<sha256>.json`; on-chain FarmProject and Fields (step 6) and the farmer's InvestorRecord (step 8).

## Success behavior

The application is `submitted` with every document in review, the fields on-chain, and (after step 8) the farmer's wallet carries the platform KYC record, so it can be the issuer of record.

## Failure behavior

- Submit refused with the missing parts named ("Fill in the company profile first", "Upload …", "Upload and register your fields first").
- A rejected document shows the arranger's reason; the farmer uploads a replacement (the old row stays as history). After submission only rejected or missing documents accept uploads.
- Registration refused by the sponsor (no mint fee, wallet budget) or the program: plain-language error from `explainChainError`.
- Privy's embedded wallet not created yet: the fields step asks to reload in a moment; KYC approval waits for a wallet.

## External dependencies

Privy, Railway Postgres and bucket, devnet RPC, the gas sponsor's SOL.

## Invariants and assumptions

- A project can only be linked by the farmer whose wallet registered it (checked against the chain).
- Fields change only while the application is a draft.
- BIN, legal name, contact and cadastral numbers never reach the chain.

## Security and privacy notes

Documents are served only to the uploader and arrangers. The profile and KYC files are private identifiers (see [data.md](../systems/data.md#security-and-privacy-notes)).

## Observability and debugging

The farmer's application page shows the timeline with the next action and who owns it; the arranger's application page shows the audit trail.

## Testing notes

`test/workflow-farmer.test.ts`, `test/farmer-actions.test.ts`, `test/farmer-cabinet.test.tsx`, `test/register-fields.test.tsx`; devnet: `scripts/demo-cabinets.ts`.

## Source map

- [src/lib/workflow/farmer.ts](../../apps/web/src/lib/workflow/farmer.ts)
- [src/app/farmer/actions.ts](../../apps/web/src/app/farmer/actions.ts)
- [src/app/farmer/](../../apps/web/src/app/farmer/) — cabinet pages
- [src/components/farmer/register-fields.tsx](../../apps/web/src/components/farmer/register-fields.tsx)

## Related docs

[Issuance pipeline](issuance-pipeline.md), [Field verification](field-verification.md), [Data](../systems/data.md), [Web app](../systems/web.md), [ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md)

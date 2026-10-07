# Issuance pipeline

## Purpose

The arranger takes a submitted application to a published pool: document review, issuer KYC, field verification, terms and publication. From `open` on the application follows the pool on-chain until it closes.

## Trigger

A farmer submits an application ([farmer onboarding](farmer-onboarding.md)).

## Participants

Arranger (`/console`, `app/console/_actions/applications.ts`), compliance (`/console/issuers`), SCAS partner (`/console/verification`), server role keys (compliance, SCAS, Issuer), Postgres, the bucket, the Program, investors.

## Step-by-step flow

| Status | Owner | What happens | Gate to leave |
| --- | --- | --- | --- |
| `draft` | farmer | application, documents, fields | submit: profile, every document, project linked |
| `submitted` | arranger | "Start document review" | none |
| `documents_review` | arranger | accept or reject each document (a rejection needs a reason; the farmer re-uploads) | every required document accepted |
| `kyc` | compliance | in `/console/issuers`: download the KYC file, approve (compliance signs `approve_investor` for the farmer's wallet) or reject ([compliance review](compliance-review.md)) | issuer KYC approved |
| `field_verification` | SCAS partner | in `/console/verification`: "Verify fields" ([season and harvest](season-and-harvest.md)) | every field verified on-chain |
| `structuring` | arranger | term builder: name, symbol, nominal (must divide the amount into whole tokens), coupon, settlement mode, close and maturity, arrangement fee; creates the pool with InstrumentTerms (farmer's wallet as issuer of record, volume, share, elevator and lab from the application) and adds the project | pool created and project added (automatic) |
| `ready` | arranger | "Publish the pool": Issuer signs `open_pool` | open |
| `open` … `closed` | chain | derived from the pool, see below | none by hand |

Derived statuses (`deriveFromChain`): Open → `open`; Funded → `funded` until every project is disbursed, then `disbursed`, `in_season` once any field has an attestation beyond FieldVerified, `harvest` once harvest is attested, `settlement` from maturity; Redeeming → `settlement`, or `closed` when no tokens remain; Refunding → `closed`. The refresh runs after every arranger action and on page loads (at most every 30 seconds) and caches changes in the row with a notification to the farmer.

A pre-open application can be rejected with a reason or withdrawn by the farmer. After publication each pool's lifecycle board in "Live pools" shows the phase, who acts next and the arranger's own steps (close subscription, disburse, record settlement, open redemption, sweep); season attestations, delivery documents, election and buyback funding belong to the SCAS partner, elevator, laboratory and farmer ([settlement](settlement.md)). The old console stays on the pool page under manual pilot tools.

## Data and state changes

`applications.status`, `pool_id`, `pool_address`; `documents` review fields; `farmer_profiles` KYC fields; `audit_log` rows per step (with signatures or the error); on-chain InvestorRecord, Attestations, Pool, PoolTerms, InstrumentTerms, FarmProject.pool.

## Success behavior

The pool is open with the term sheet; the application shows `open` and follows the chain from there.

## Failure behavior

- Each gate names what is missing ("Accept every required document first (2 left)", "Approve the issuer's KYC first", "Verify every field with the SCAS stub first").
- A failed transaction is shown in plain language and recorded in the audit log with its error. A term builder run that created the pool but failed to add the project keeps the pool id; the next run only adds the project.
- Statuses never move backwards by hand; chain-derived statuses cannot be edited.

## External dependencies

Devnet RPC (public, rate-limited), role keys' SOL, the bucket (quality spec, evidence), Postgres.

## Invariants and assumptions

- Only the transitions above are allowed (`canTransition`).
- The issuer of record is the on-chain producer of the application's project, and must hold an approved KYC record (the program checks it).
- Every step is authorized by the arranger role, loaded from Postgres on each request.

## Security and privacy notes

Arranger actions sign with server keys; the role guard runs first. Private data shown to arrangers (BIN, legal name) never goes on-chain: the pool's metadata carries only crop, season, name and symbol.

## Observability and debugging

`/console/applications` board and status filters, the application's Activity table, `/console/audit`, Solana Explorer links.

## Testing notes

`test/workflow-arranger.test.ts` walks the whole pipeline on PGlite with a fake chain, including every gate and failed-attempt auditing; `test/application-status.test.ts` pins transitions and derivation; `scripts/demo-cabinets.ts` walks it on devnet.

## Source map

- [src/lib/workflow/arranger.ts](../../apps/web/src/lib/workflow/arranger.ts)
- [src/lib/application-status.ts](../../apps/web/src/lib/application-status.ts)
- [src/lib/chain/arranger-chain.ts](../../apps/web/src/lib/chain/arranger-chain.ts)
- [src/app/arranger/applications/[id]/page.tsx](../../apps/web/src/app/console/applications/[id]/page.tsx)
- [src/lib/demo/cabinet-flow.ts](../../apps/web/src/lib/demo/cabinet-flow.ts)

## Related docs

[Farmer onboarding](farmer-onboarding.md), [Investor onboarding](investor-onboarding.md), [Pool lifecycle](pool-lifecycle.md), [Field verification](field-verification.md), [ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md), [ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md)

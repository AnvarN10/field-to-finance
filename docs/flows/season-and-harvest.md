# Season and harvest

## Purpose

From disbursement to the harvest documents: the SCAS partner attests the season, the elevator records what it received and the laboratory records the quality protocol.

## Trigger

A pool is Funded and every project is disbursed.

## Participants

SCAS partner (`/scas`), elevator and laboratory (`/elevator`), or an arranger acting for them; the SCAS key and the platform Issuer key; the bucket; the Program.

## Step-by-step flow

1. **Field verification** (before structuring): `/scas` lists applications in `field_verification` with the boundaries on the satellite map; "Verify fields" writes one FieldVerified attestation per field (SCAS key).
2. **Season** (`/scas/pools/<id>`): the partner records Sowing, Vegetation or the pre-harvest yield estimate (a Harvest attestation; the estimate in t/ha is required) with an observation and an optional evidence file. The file goes to `documents/<sha256>` (private, registered to the uploader); the evidence JSON (stub notice, observation, file hash, estimate) goes to `evidence/<sha256>.json`; then one `record_attestation` per field. Allowed only while the pool is Funded or Redeeming.
3. **Elevator receipt** (`/elevator`, elevator role): tonnes received, receipt number (never stored: the public evidence carries a salted commitment `sha256("<salt>:<number>")`, the salt stays in the private audit log, so the number cannot be guessed back from the hash), receiving date, receipt file. Evidence JSON, then `record_delivery(ElevatorReceipt, Pass)`.
4. **Lab protocol** (`/elevator`, lab role): the twelve measurements against the pool's quality spec (loaded from the bucket by its on-chain hash). `evaluateLab` marks each parameter pass or fail; any fail gives verdict Fail, any missing value InsufficientData, otherwise Pass. Evidence JSON with measurements and results, then `record_delivery(LabQuality, verdict)`.
5. The farmer and the pool's investors are notified after each step; the public pool page shows the season timeline and, once recorded, the harvest and quality block.

## Data and state changes

Attestation accounts; InstrumentTerms receipt hash, lab certificate hash and lab verdict; `documents` rows for uploaded files; `audit_log` rows `pool.attest_stage`, `pool.record_delivery` with the acting role.

## Success behavior

Delivery documents in place: holders can claim grain after maturity when delivery applies ([settlement](settlement.md)).

## Failure behavior

Season attestations before funding answer with the blocker ("Season attestations open once the pool is funded"). Delivery documents are refused for a cash-only pool, an elected buyback or a pool that is not Funded. Each role is refused the other's form.

## External dependencies

Devnet RPC, the SCAS and Issuer keys' SOL, the bucket.

## Invariants and assumptions

- Evidence is stored before the attestation that points at it.
- A receipt number never leaves the server in clear, and its public commitment is salted.

## Edge cases

- A failed lab protocol before a Hybrid election does not block the election: the issuer may still choose the buyback.

## Observability

Season timeline on `/scas/pools/<id>` and the public pool page; audit log.

## Related docs

[Field verification](field-verification.md), [ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md), [ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md), [ADR 0017](../architecture/decisions/0017-service-role-cabinets.md)

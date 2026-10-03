---
status: Accepted
date: "2026-10-03"
---

# SCAS is an external provider; the MVP uses a stub

## Context

ADR 0008 had our own worker pull Sentinel-2 NDVI and sign Attestations. SCAS is meant to be an independent verifier, and the team will integrate an external SCAS provider rather than operate one. Building and running a satellite pipeline before the 2026-10-12 deadline would cost days that the web app and the demo need.

## Decision

- SCAS is an external provider, integrated after the hackathon.
- For the MVP the web server runs a SCAS stub (`apps/web/src/lib/scas-stub.ts`). It writes an evidence document that states it is a stub ("External SCAS provider integration pending"), stores it in the Railway bucket under its SHA-256, and signs `record_attestation` with the SCAS key (`Config.scas`): verdict `Pass`, NDVI 0, scene date = now.
- Every Attestation shown in the UI carries the badge "Verified by SCAS stub: external provider pending".
- The Program, the Attestation account layout and the evidence hash and URI scheme do not change, so a real provider can replace the stub by signing with its own key after `Config.scas` is rotated.

## Consequences

- The demo shows the full Attestation mechanics on-chain (signer check, hash-linked public evidence, `FieldVerified` gating `add_project`, `Harvest` gating settlement) without satellite data.
- No NDVI chart and no Sentinel-2 numbers in the MVP; spec success criterion 2 changes accordingly.
- No separate SCAS worker service: ADR 0010's second Railway service is not deployed for the MVP. `apps/scas-worker` stays in the repo, stopped (see its plan).
- The SCAS key now lives in the web service's environment. It is still separate from the Issuer and admin keys.

## Alternatives considered

- Finish the Sentinel-2 worker (ADR 0008): real data, about three more days of work before the deadline.
- Mock Attestations in the UI only: faster, but nothing on-chain; judges could not verify anything.

## Related code

- `apps/web/src/lib/scas-stub.ts`
- `apps/web/src/app/api/evidence/[hash]/route.ts`

## Related docs

- [ADR 0008](0008-scas-sentinel2-signed-attestations.md) (superseded)
- [Field verification flow](../../flows/field-verification.md)

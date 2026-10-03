---
status: Superseded
date: "2026-10-03"
superseded_by: docs/architecture/decisions/0012-scas-external-provider-stub.md
---

# SCAS uses real Sentinel-2 NDVI and signs Attestations

## Context

Future grain cannot be inspected. What exists today are the fields and the season's progress, which satellites can observe.

## Decision

For one or two real fields, SCAS pulls Sentinel-2 imagery, computes NDVI over the field polygon and stores the evidence off-chain. It signs an Attestation with the SCAS key; the Program stores the evidence hash, the verdict and the signer.

## Consequences

- The demo shows real data, not mocks.
- Clouds can block observations; the worker must handle missing scenes.
- The SCAS key is a trust point and must be separate from Issuer and admin keys.

## Alternatives considered

- Mocked data: faster, weaker demo.
- A third-party oracle network: more decentralised, more integration work.

## Related code

None yet.

## Related docs

- [Glossary: Attestation](../../glossary.md#attestation)

---
status: Accepted
date: "2026-10-03"
---

# Deploy on Railway

## Context

The web app and the SCAS worker need hosting for the devnet demo. The SCAS worker holds a signing key and runs scheduled jobs.

## Decision

Deploy the web app and the SCAS worker as two services in one Railway project in the "Yesset's projects" workspace. Evidence documents go to a Railway bucket. The Program is deployed to Solana devnet.

## Consequences

- One place for both services, their variables and logs.
- Secrets are synced from Infisical into Railway variables; signing keys never enter the repo.

## Alternatives considered

- Vercel for the web app plus a separate host for the worker: two platforms to manage.

## Related code

None yet.

## Related docs

- [ADR 0008](0008-scas-sentinel2-signed-attestations.md)
- [ADR 0009](0009-worker-language.md)

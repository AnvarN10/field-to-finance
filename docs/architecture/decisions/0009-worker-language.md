---
status: Accepted
date: "2026-10-03"
---

# Language for the SCAS worker and backend

## Context

The worker fetches satellite statistics, stores evidence, signs Attestations and sends Program transactions. The web app is TypeScript and Anchor generates a TypeScript client.

## Decision

Write the SCAS worker and any backend code in TypeScript.

## Consequences

- The worker reuses the generated Anchor client and domain types shared with the web app.
- One language across web, worker and tests.

## Alternatives considered

- Go: needs a community Solana client and a copy of the program types.
- Rust: shares types with the program, slowest to write in nine days.

## Related code

None yet.

## Related docs

- [ADR 0002](0002-anchor-and-nextjs.md)

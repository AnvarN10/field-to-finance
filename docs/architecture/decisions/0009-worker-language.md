---
status: Proposed
date: "2026-10-03"
---

# Language for the SCAS worker and backend

## Context

The worker fetches satellite statistics, stores evidence, signs Attestations and sends Program transactions. The web app is TypeScript and Anchor generates a TypeScript client.

## Decision

Not decided. Options: TypeScript, Go, Rust.

## Consequences

- TypeScript reuses the generated Anchor client and domain types from the web app.
- Rust could share types with the program but is slower to write.
- Go is fast to write for services but needs a community Solana client and its own copy of the program types.

## Alternatives considered

See options above.

## Related code

None yet.

## Related docs

- [ADR 0002](0002-anchor-and-nextjs.md)

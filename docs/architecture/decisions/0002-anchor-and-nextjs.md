---
status: Accepted
date: "2026-10-03"
---

# Anchor for the program, Next.js for the web app

## Context

The hackathon lasts five weeks. The team needs the fastest path to a working, demoable program and UI.

## Decision

Write the Solana program in Anchor. Build the web app in Next.js.

## Consequences

- Anchor generates an IDL and a TypeScript client that the web app and a TypeScript worker can share.
- Anchor costs more compute than Pinocchio or native programs; acceptable for the MVP.

## Alternatives considered

- Pinocchio or native Rust: cheaper compute, slower to build.

## Related code

None yet.

## Related docs

- [ADR 0001](0001-nx-monorepo.md)

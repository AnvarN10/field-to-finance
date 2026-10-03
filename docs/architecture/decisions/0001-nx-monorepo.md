---
status: Accepted
date: "2026-10-03"
---

# Nx monorepo

## Context

The repo holds a Solana program, a web app, a worker and shared packages such as the generated program client and domain types. Builds and tests must run per project and be cached.

## Decision

Use Nx to manage the monorepo.

## Consequences

- Task graph and caching across Anchor, Next.js and worker projects.
- Nx has no first-class Anchor plugin; Anchor builds run as Nx `run-commands` targets.

## Alternatives considered

- moon: lighter, but smaller ecosystem for Next.js.
- Plain pnpm workspaces: simplest, no task caching or project graph.

## Related code

None yet.

## Related docs

- [ADR 0002](0002-anchor-and-nextjs.md)

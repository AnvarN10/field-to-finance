---
status: Accepted
date: "2026-10-03"
---

# USDC settlement, USD-only display

## Context

Investors and the Solana ecosystem use USDC. The pilot's payment on-ramp converts fiat to and from it.

## Decision

All on-chain money is USDC. The UI shows amounts in USD only.

## Consequences

- Farmer-side currency conversion happens off-chain through the on-ramp partner.
- Devnet uses a test USDC mint.

## Alternatives considered

- A test stablecoin on the Kazakhstani tenge: closer to the local market, unfamiliar to judges and investors.

## Related code

None yet.

## Related docs

- [ADR 0006](0006-pooled-instrument-and-shortfall-rules.md)

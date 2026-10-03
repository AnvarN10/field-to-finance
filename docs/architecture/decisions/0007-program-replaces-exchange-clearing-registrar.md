---
status: Accepted
date: "2026-10-03"
---

# MVP scope: Primary Market only, Program plays Exchange, Clearing and Registrar

## Context

The business model has ten roles. A build of about nine days cannot implement them as separate systems. On Solana, matching, clearing and registry updates can happen in one atomic transaction.

## Decision

The MVP covers Producer, SCAS, Issuer, Investor and redemption. The Program sells the Instrument for USDC atomically, which covers the Exchange, Clearing and Registrar roles for the Primary Market. Compliance is limited to KYC Thaw. The Secondary Market is a stretch goal.

## Consequences

- No order book in the MVP.
- Regulator and System Admin views are out of scope unless time remains.

## Alternatives considered

- Adding a Secondary Market order book.
- Implementing all ten roles.

## Related code

None yet.

## Related docs

- [ADR 0003](0003-token-2022-frozen-accounts-kyc-thaw.md)

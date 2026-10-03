---
status: Accepted
date: "2026-10-03"
---

# Token-2022 Instrument with frozen-by-default accounts and KYC Thaw

## Context

Only KYC-approved investors may hold the Instrument. Compliance should be enforced by the token itself, not only by the UI.

## Decision

Each Pool's Instrument is a Token-2022 mint with the Default Account State extension set to frozen. The freeze authority is a Program PDA. After KYC passes, the Program thaws the investor's token account.

## Consequences

- A wallet without KYC cannot receive the Instrument.
- The freeze authority can also freeze an account for compliance reasons; this must be disclosed to investors.
- A transfer hook with a whitelist check is the planned addition if the Secondary Market is built.

## Alternatives considered

- Transfer hook from day one: stronger control of every transfer, more work, not needed for the Primary Market.
- Plain SPL token: no on-chain compliance.

## Related code

None yet.

## Related docs

- [ADR 0007](0007-program-replaces-exchange-clearing-registrar.md)

---
status: Accepted
date: "2026-10-03"
---

# Investors bring wallets, farmers get embedded wallets

## Context

Investors are crypto-native. Farmers are not and should not manage seed phrases. A fully custodial model concentrates risk in the platform.

## Decision

Investors connect their own wallet, for example Phantom. Producers sign in with email and get an embedded wallet from a provider such as Privy or Web3Auth.

## Consequences

- No platform-held master wallet for user funds.
- The embedded wallet provider is a dependency for the farmer flow; the choice of provider is an implementation detail.

## Alternatives considered

- Fully custodial wallets: simplest onboarding, the platform becomes a custodian.

## Related code

None yet.

## Related docs

- [ADR 0003](0003-token-2022-frozen-accounts-kyc-thaw.md)

---
status: Accepted
date: "2026-10-03"
---

# Platform-level KYC, Instrument account thawed on first subscription

## Context

ADR 0003 made every Instrument account frozen by default and thawed after KYC. The first implementation thawed inside `approve_investor`, which took a Pool. Every Pool has its own mint, so compliance had to approve the same investor again for each new Pool, and an investor approved for one Pool hit an unexplained `AccountFrozen` error in another. KYC belongs to the person, not to a Pool.

## Decision

- Each Pool's Instrument stays a Token-2022 mint with Default Account State = Frozen and the Pool PDA as freeze authority.
- `approve_investor` is platform-level: it takes no Pool and only sets the wallet's InvestorRecord to approved.
- `subscribe` creates the investor's Instrument account for that Pool if needed and, when the record is approved, thaws it in the same transaction before minting.
- `revoke_investor` clears the approval and freezes the investor's account in the given Pool if that account exists.

## Consequences

- One KYC approval works for every current and future Pool.
- A wallet without approval still cannot receive the Instrument: `subscribe` fails on the missing or unapproved record, and nothing thaws its account.
- The investor pays rent for their Instrument account on first subscription.
- Revoking freezes holdings one Pool at a time.

## Alternatives considered

- Keep per-Pool approval: repeated compliance work and confusing errors.
- A transfer hook checking the record on every transfer: stronger, more work, not needed without a Secondary Market.

## Related code

- `anchor/programs/f2f/src/instructions/approve_investor.rs`
- `anchor/programs/f2f/src/instructions/subscribe.rs`
- `anchor/programs/f2f/src/instructions/revoke_investor.rs`

## Related docs

- Supersedes [ADR 0003](0003-token-2022-frozen-accounts-kyc-thaw.md)
- [Program](../../systems/program.md)

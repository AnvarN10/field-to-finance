# Pool lifecycle

## Purpose

Carries one Pool from registered fields to investor redemption. This is the main story of the demo.

## Trigger

A Producer registers a Farm Project.

## Participants

Producer, SCAS (stub in the web app), Issuer, compliance, investors, the [program](../systems/program.md).

## Step-by-step flow

| # | Step | Instruction | Signer |
| --- | --- | --- | --- |
| 1 | Producer registers the Farm Project | `register_project` | Producer |
| 2 | Producer adds each Field | `register_field` | Producer |
| 3 | SCAS (stub until the external provider) attests each Field | `record_attestation(FieldVerified, Pass)` | SCAS |
| 4 | Issuer creates the Pool and its Instrument | `create_pool` | Issuer |
| 5 | Issuer adds verified projects and opens the Pool | `add_project`, `open_pool` | Issuer |
| 6 | Compliance approves an investor once for every pool | `approve_investor` | compliance |
| 7 | Investor pays USDC; the Instrument account is created, thawed and credited | `subscribe` | investor |
| 8 | Subscription closes at target or after the close time | `close_subscription` | anyone |
| 9 | Issuer pays each Producer | `disburse` | Issuer |
| 10 | SCAS (stub) attests the season | `record_attestation(Sowing, Vegetation, Harvest)` | SCAS |
| 11 | Issuer records the Shortfall rule per project | `record_settlement` | Issuer |
| 12 | Issuer deposits principal plus yield; after maturity the Pool opens for redemption | `fund_redemption` | Issuer |
| 13 | Investor burns the Instrument and receives principal plus yield | `redeem` | investor |

If the Pool is under target at the close time, step 8 moves it to Refunding and investors call `refund` instead of steps 9 to 13.

## Data and state changes

Pool status moves Draft, Open, Funded or Refunding, then Redeeming. Field and project counters change in steps 2, 3 and 10. USDC moves in steps 7, 9, 12, 13 and in refunds.

## Success behavior

Every investor redeems `amount × (1 + yield)` USDC, the vault empties, and every project carries a settlement rule.

## Failure behavior

- An unverified Field blocks `add_project`.
- An investor without approval cannot subscribe: the InvestorRecord is missing and the token account is frozen.
- `fund_redemption` keeps the Pool Funded until all conditions hold; it can be called again with zero to re-check.

## External dependencies

Solana devnet, USDC mint, the SCAS stub in the web app ([ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md)).

## Invariants and assumptions

See the program's [invariants](../systems/program.md#invariants-and-assumptions).

## Security and privacy notes

Each step checks its role key against Config. Investor identity data stays off-chain.

## Observability and debugging

Each transaction has an explorer link; failures name the `F2fError` variant in logs.

## Testing notes

`anchor/programs/f2f/tests/test_redemption.rs` runs the whole lifecycle with partial redemptions.

## Source map

- [instructions/](../../anchor/programs/f2f/src/instructions/)
- [test_redemption.rs](../../anchor/programs/f2f/tests/test_redemption.rs)

## Related docs

- [Program](../systems/program.md)
- [Web app](../systems/web.md)
- [MVP design, section 5](../specs/2026-10-03-mvp-design.md#5-main-flow)

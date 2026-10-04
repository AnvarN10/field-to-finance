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
| 1 | Producer registers the Farm Project and prepays the mint fee (3 USDC) | `register_project` | Producer; gas sponsor pays fee and rent |
| 2 | Producer adds each Field | `register_field` | Producer; gas sponsor pays fee and rent |
| 3 | SCAS (stub until the external provider) attests each Field | `record_attestation(FieldVerified, Pass)` | SCAS |
| 4 | Issuer creates the Pool and its Instrument and, while Draft, sets the arrangement fee | `create_pool`, `set_arrangement_fee` | Issuer |
| 5 | Issuer adds verified projects and opens the Pool | `add_project`, `open_pool` | Issuer |
| 6 | Compliance approves an investor once for every pool | `approve_investor` | compliance |
| 7 | Investor pays USDC plus the network fee; the Instrument account is created, thawed and credited | `subscribe` | investor; gas sponsor pays fee and rent |
| 8 | Subscription closes at target or after the close time | `close_subscription` | anyone |
| 9 | Issuer pays each Producer, withholding the arrangement fee for the treasury | `disburse` | Issuer |
| 10 | SCAS (stub) attests the season | `record_attestation(Sowing, Vegetation, Harvest)` | SCAS |
| 11 | Issuer records the Shortfall rule per project | `record_settlement` | Issuer |
| 12 | Issuer deposits principal plus yield; after maturity the Pool opens for redemption | `fund_redemption` | Issuer |
| 13 | Investor burns the Instrument and receives principal plus yield | `redeem` | investor |

If the Pool is under target at the close time, step 8 moves it to Refunding and investors call `refund` instead of steps 9 to 13.

### Term-sheet pools (pilot, ADR 0014)

The farmer is the issuer of record, the Issuer key acts as Arranger, and settlement is hybrid. Differences from the table above:

| # | Step | Instruction | Signer |
| --- | --- | --- | --- |
| 0 | Compliance approves the farmer (full KYC of the issuer); the Arranger collects the farmer requirements into the bucket | `approve_investor` | compliance |
| 4 | Arranger creates the Pool and, in the same transaction, sets the Instrument Terms and the issuer of record | `create_pool`, `set_instrument_terms` | Issuer (Arranger) |
| 5 | Only the farmer's projects can join; the target must be whole tokens | `add_project`, `open_pool` | Issuer (Arranger) |
| 7 | Investor buys whole tokens of the nominal | `subscribe` | investor; gas sponsor pays |
| 11a | Before maturity the farmer (or the Arranger) elects Buyback or Delivery; none by maturity means Delivery | `elect_settlement` | issuer of record or Arranger |
| 12b | Buyback: the farmer funds principal plus the Act/360 coupon; after maturity the Pool opens for redemption | `fund_redemption` | issuer of record or Arranger |
| 13b | Buyback: investor redeems for principal plus coupon | `redeem` | investor |
| 12d | Delivery: the elevator receipt and the lab certificate are recorded | `record_delivery(ElevatorReceipt, LabQuality)` | SCAS or Arranger |
| 13d | Delivery: after maturity the investor burns tokens for a Grain Claim (pro rata to the tokenized volume) | `redeem_delivery` | investor; gas sponsor pays |

The Grain Claim is honoured off-chain against the elevator receipt; later it maps to a grain-receipt token on CommodityChain.

## Data and state changes

Pool status moves Draft, Open, Funded or Refunding, then Redeeming. Field and project counters change in steps 2, 3 and 10. USDC moves in steps 1 (mint fee), 7 (amount and network fee), 9 (net to the Producer, arrangement fee to the treasury), 12, 13 and in refunds. Fees follow [ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md); a refund returns the amount, not the network fee.

## Success behavior

Every investor redeems `amount × (1 + yield)` USDC, the vault empties, and every project carries a settlement rule. On a term-sheet pool a buyback pays `amount × (1 + coupon × days / 360)`, floored; a delivery records Grain Claims that add up to at most the tokenized volume.

## Failure behavior

- An unverified Field blocks `add_project`.
- An investor without approval cannot subscribe: the InvestorRecord is missing and the token account is frozen.
- `fund_redemption` keeps the Pool Funded until all conditions hold; it can be called again with zero to re-check.
- Term-sheet pools: a fraction of a token fails with `NotWholeTokens`; once delivery applies `fund_redemption` fails with `DeliveryElected`; `redeem_delivery` waits for maturity (`NotMatured`) and for a receipt plus a passing lab certificate (`DeliveryNotAttested`).

## External dependencies

Solana devnet, USDC mint, the SCAS stub in the web app ([ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md)).

## Invariants and assumptions

See the program's [invariants](../systems/program.md#invariants-and-assumptions).

## Security and privacy notes

Each step checks its role key against Config. Investor identity data stays off-chain.

## Observability and debugging

Each transaction has an explorer link; failures name the `F2fError` variant in logs.

## Testing notes

`anchor/programs/f2f/tests/test_redemption.rs` runs the whole lifecycle with partial redemptions; `tests/test_instrument.rs` runs the pilot terms on both settlement paths. On devnet: `scripts/inf.sh pnpm demo` (MVP pool) and `scripts/inf.sh pnpm exec tsx scripts/demo-pilot.ts buyback|delivery` (pilot terms).

## Source map

- [instructions/](../../anchor/programs/f2f/src/instructions/)
- [test_redemption.rs](../../anchor/programs/f2f/tests/test_redemption.rs)

## Related docs

- [Program](../systems/program.md)
- [Web app](../systems/web.md)
- [MVP design, section 5](../specs/2026-10-03-mvp-design.md#5-main-flow)

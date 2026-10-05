# Settlement

## Purpose

From the issuer's election to the last redemption or Grain Claim and the closing of the pool.

## Trigger

A term-sheet pool is Funded and disbursed; on a Hybrid pool the issuer may elect until maturity.

## Participants

Farmer issuer (`/farmer`, Privy wallet), investors (`/investor`), arranger (`/arranger/pools/<id>` lifecycle board), regulator (`/regulator`), the gas sponsor, the Program.

## Step-by-step flow

1. **Election** (Hybrid only, before maturity): the obligations card offers "Elect buyback" and "Elect delivery" (confirmed). The farmer's wallet signs `elect_settlement` as a sponsored transaction; `/api/tx/elect-settlement` builds it only for the pool's issuer of record and the sponsor co-signs only for that wallet. An arranger can still elect from the manual tools. Without a buyback election delivery applies after maturity.
2. **Buyback funding**: once buyback is elected the card shows the shortfall (principal plus Act/360 coupon minus the vault), the funding deadline (maturity) and the lapse date (7 days after maturity). "Fund buyback" signs `fund_redemption` from the farmer's own USDC account (sponsored).
3. **After maturity, buyback path**: the lifecycle board gives the arranger "Record the settlement of each project" (CashRepaidWithPremium on the buyback path) and then "Open redemption" (`fund_redemption` with what is still missing, normally 0, which moves the pool to Redeeming). Investors redeem from `/investor/pools/<id>`; when no tokens remain the board offers the sweep.
4. **After maturity, delivery path**: with the elevator receipt and a passing lab protocol recorded, investors burn tokens for a Grain Claim (`redeem_delivery`, sponsored). The investor cabinet lists Grain Claim certificates (tonnes, elevator, laboratory result, transaction).
5. **Closing and oversight**: the arranger downloads the pool's final report (CSV). The regulator sees the registry, holders and events and exports them as CSV.

## Data and state changes

InstrumentTerms election; vault balance; FarmProject settlement; Pool status Redeeming; Instrument supply; `audit_log` `tx.elect-settlement`, `tx.fund-redemption`, `pool.record_settlement`, `pool.fund_redemption`, `tx.redeem`, `tx.redeem-delivery`, `pool.sweep`; notifications to the farmer and the pool's investors.

## Success behavior

Every holder is paid in cash or holds a Grain Claim; the application shows `closed`.

## Failure behavior

A wallet other than the issuer of record gets 403 at build and at co-signing. Cash deposits before a buyback election are refused by the program (`ElectionPending`) and the card does not offer them. An unfunded buyback lapses into delivery 7 days after maturity.

## External dependencies

Devnet RPC, the sponsor's SOL, test USDC for the farmer (the coupon exceeds the proceeds; the arranger mints test USDC on devnet).

## Invariants and assumptions

- Only the issuer of record or the arranger elects; only the issuer or the arranger funds.
- Payouts are floored to the cent in the UI, never above what the program pays.

## Edge cases

- Pools without a term sheet: the board opens redemption after settlement; the Issuer key funds any shortfall (devnet convenience).

## Observability

Lifecycle board, audit log, `/regulator/events`.

## Related docs

[Pool lifecycle](pool-lifecycle.md), [ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md), [ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md), [ADR 0017](../architecture/decisions/0017-service-role-cabinets.md)

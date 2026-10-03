---
status: Accepted
date: "2026-10-03"
---

# Pooled fixed-yield Instrument, 30% Tokenized Share, Shortfall rules

## Context

Investors need a simple product. A single farm's harvest is risky, and a forecast can miss on volume or quality.

## Decision

- One Instrument per Pool, for example `WHEAT-2027`, with a fixed yield.
- Only 30% of each Farm Project's expected harvest is the Tokenized Share.
- Shortfall rules, in order:
  1. **Volume shortfall.** The Producer covers the missing tonnes from their other fields.
  2. **Quality shortfall.** If the delivered grain is below the contracted class, the Producer buys grain of that class on the market.
  3. **No such quality on the market.** The Producer repays in USD with a fixed premium of 5–6%.

## Consequences

- The 70% buffer makes a volume shortfall unlikely to reach investors.
- The Program must record which rule settled each Farm Project.

## Alternatives considered

- One token per farmer: concentrated risk, harder to compare.
- Harvest-linked payout: harder to explain and to settle.

## Open questions

- In the normal case, is the Instrument redeemed in USDC from the sale of the delivered grain, or does the Issuer pay the fixed yield regardless of the sale price?
- Exact premium: 5% or 6%, and is it fixed per Pool?
- Who sells the delivered grain and who carries the price risk between harvest and sale?

## Related code

None yet.

## Related docs

- [Glossary: Shortfall](../../glossary.md#shortfall)

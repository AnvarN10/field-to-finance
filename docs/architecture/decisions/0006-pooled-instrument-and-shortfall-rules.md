---
status: Accepted
date: "2026-10-03"
---

# Pooled fixed-yield Instrument, 30% Tokenized Share, Shortfall rules

## Context

Investors need a simple product. A single farm's harvest is risky, and a forecast can miss on volume or quality.

## Decision

- One Instrument per Pool, for example `WHEAT-2027`, with a fixed yield.
- In the normal case the Issuer pays principal plus the fixed yield in USDC at maturity, regardless of the grain price. The Issuer carries the grain price risk.
- Only 30% of each Farm Project's expected harvest is the Tokenized Share.
- Shortfall rules, in order:
  1. **Volume shortfall.** The Producer covers the missing tonnes from their other fields.
  2. **Quality shortfall.** If the delivered grain is below the contracted class, the Producer buys grain of that class on the market.
  3. **No such quality on the market.** The Producer repays the financing in USD with a fixed premium. The Issuer sets the premium per Pool between 5% and 6% when the Pool is created; the Program stores it and rejects values outside that range.
- Investors receive the same fixed yield whichever Shortfall rule settles a Farm Project.

## Consequences

- The 70% buffer makes a volume shortfall unlikely to reach investors.
- The Program must record which rule settled each Farm Project.

## Alternatives considered

- One token per farmer: concentrated risk, harder to compare.
- Harvest-linked payout: harder to explain and to settle.

## Open questions

- Who sells the delivered grain and when. This does not affect investors, because the Issuer pays a fixed yield.

## Related code

None yet.

## Related docs

- [Glossary: Shortfall](../../glossary.md#shortfall)

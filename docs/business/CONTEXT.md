# Business context

Summary of the source materials in [raw/](raw/). Update it whenever a new source is added.

Sources:

- [field-to-finance-explainer-ru-2026-08.pdf](raw/field-to-finance-explainer-ru-2026-08.pdf) — plain-language explainer for farmers, investors and regulators, August 2026, in Russian.

## Domain

A farmer needs money for seed, fertilizer, fuel, machinery and wages months before harvest. Lending against stored grain does not help, because next season's grain does not exist yet. Field-to-Finance finances part of the future harvest instead.

Example from the explainer: in autumn 2026 a farmer plans to sow 2,000 ha of wheat in spring 2027, expects about 4,000 t and needs 100 million tenge for the season. The platform verifies the fields, an Issuer packages the project into an Instrument, investors fund it, and obligations are settled after harvest.

The platform does not promise the harvest or the price. It makes the risk visible and the data verifiable.

## Participants and roles

| Role | Question it answers |
| --- | --- |
| Producer | "I grow the grain and need money before harvest." |
| SCAS | "Are the fields and the season data confirmed?" |
| Issuer | Turns a verified project into a legally structured Instrument and carries its obligations. |
| Investor | Chooses a verified Instrument to fund. |
| Exchange | Matches buyers and sellers. Primary Market funds farmers; Secondary Market moves positions between investors. |
| Clearing | Makes sure a concluded trade is executed correctly. |
| Registrar | Records who holds the Instrument. |
| Compliance | KYC, KYB and AML checks on participants and operations. |
| Regulator | Supervises the market and licensed participants. |
| System Admin | Runs the platform technically; not a party to deals. |

MVP coverage is defined in [ADR 0007](../architecture/decisions/0007-program-replaces-exchange-clearing-registrar.md).

## Key processes

The deal lifecycle: Field, SCAS verification, Instrument, Exchange, money, harvest, settlement.

1. The Producer declares fields, crop, expected yield and the amount needed.
2. SCAS confirms the fields, documents and satellite data.
3. The Issuer creates the Instrument tied to a verified Pool of Farm Projects: amount, term, yield, redemption rules, risks.
4. The Instrument is offered on the Primary Market.
5. Clearing executes the trades; the Registrar records holders.
6. During the season SCAS confirms sowing and crop condition.
7. After harvest the Instrument is redeemed according to its terms.

What an investor sees on the Instrument card: the Issuer, the Pool of Farm Projects, SCAS checks performed, amount and term, yield and redemption terms, main risks, placement status and documents.

## Product decisions

Settled decisions are recorded as ADRs in [../architecture/decisions/](../architecture/decisions/README.md). The most business-relevant one is the [Shortfall rules](../architecture/decisions/0006-pooled-instrument-and-shortfall-rules.md).

## Pilot

Real farmers and a contracted Swiss payment on-ramp are lined up for a pilot. Letters of intent from both are expected before the submission deadline. The demo uses real field contours from the pilot farmers, plus test investors and test USDC on devnet.

## Legal structure

Roles, AFSA licence names, placement options, custody and money flows: [legal-structure.md](legal-structure.md).

## Open questions

- Legal form of the Issuer and the jurisdiction of the Instrument.
- How SCAS is operated: in-house or a third party, and who holds its key.
- Term of the Instrument relative to harvest and grain sale dates.

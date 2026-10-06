# Business context

Summary of the source materials in [raw/](raw/). Update it whenever a new source is added.

Sources:

- [field-to-finance-explainer-ru-2026-08.pdf](raw/field-to-finance-explainer-ru-2026-08.pdf) — plain-language explainer for farmers, investors and regulators, August 2026, in Russian.
- [pilot-digital-asset-contract-2026-10.csv](raw/pilot-digital-asset-contract-2026-10.csv) — Digital Asset Contract (DAC) term sheet for the first pilot farmer, October 2026, in Russian. Pilot data: keep private.

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

## Pilot term sheet (Digital Asset Contract)

First pilot farmer, East Kazakhstan (delivery elevator Ust-Kamenogorsk), around 11 thousand ha of farmland with field-level satellite monitoring (NDVI, soil temperature, soil moisture, precipitation history since 2019). Identifiers of the farmer stay out of public material until the team decides otherwise.

| Item | Term |
| --- | --- |
| Instrument | WHEAT-2027, planned as an AFSA Investment Token |
| Issuer | the farmer (the offer contract is between CommodityChain and the issuer; full KYC of the issuer; the issuer pays the issuance fee) |
| Farmer requirements | insurance; land-use right (state act, cadastral number); 4 financial statements, payables incl. loans, encumbrance certificate; historical field yields; field imagery |
| Commodity | wheat, HiPro class 3: gluten ≥30, protein ≥15, moisture 14% (12%), falling number ≥200, test weight ≥750, impurities ≤2%, no odour, gluten deformation index ≤75, vitreousness ≥50, no pests |
| Volume | 10,000 t, tokenized share ≤30% of the harvest |
| Delivery | elevator in Ust-Kamenogorsk; laboratory Baltic Control |
| Token type | hybrid: grain delivery with the issuer's right to buy the token back |
| Currency | USD |
| Nominal | USD 100,000 per token, 10 tokens, USD 1,000,000 issue |
| Interest | 5% per year, actual/360 |
| Dates | start and maturity TBD |
| Force majeure | per CommodityChain exchange terms |

How the platform implements it ([ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md)): the farmer's KYC-approved wallet is the issuer of record of the pool; Field-to-Finance is the arranger. InstrumentTerms on-chain hold the nominal (USD 100,000), coupon (5%, Act/360), interest start, hybrid settlement, 10,000 t at 30% tokenized, the hash of the 12-parameter quality spec, the elevator and the laboratory. Investors buy whole tokens. Before maturity the farmer elects buyback (cash: principal plus coupon, e.g. USD 1,041,666.66 on USD 1,000,000 for 300 days) or delivery; without an election delivery applies. Delivery needs the elevator receipt and a passing lab certificate on-chain; holders then burn tokens for a Grain Claim on the elevator. The farmer requirements are a per-application checklist in the farmer cabinet, reviewed by the arranger, with documents stored off-chain by hash. The platform is behind basic auth ([ADR 0015](../architecture/decisions/0015-basic-auth-on-the-pilot-platform.md)) so the real pilot farm can be shown.

Still missing from the pilot farmer (as of 2026-10-05): field boundaries as an export (GeoJSON or KML; only screenshots so far), cadastral numbers and areas per field from the land-use acts, the documents of the requirement list, start and maturity dates, and the farmer's wallet for the issuer of record. Until then the devnet pilot pool uses labelled sample fields and a stand-in issuer key.

## Role cabinets

Each party works in its own cabinet behind Privy email sign-in ([ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md), [spec](../specs/2026-10-05-role-cabinets.md)): the farmer issuer applies, uploads the term sheet documents and registers fields; the arranger (F2F, also compliance and SCAS-stub operator in the pilot) reviews, approves KYC, verifies, structures and publishes; the investor is categorized (retail limits shown), passes KYC, accepts each pool's key features document and subscribes. Workflow data is in Postgres; private identifiers never go on-chain. Flows: [farmer onboarding](../flows/farmer-onboarding.md), [investor onboarding](../flows/investor-onboarding.md), [issuance pipeline](../flows/issuance-pipeline.md).

## Legal structure

Roles, AFSA licence names, placement options, custody and money flows: [legal-structure.md](legal-structure.md). Full research digest in Russian with a glossary of terms, AIFC rule footnotes and a crypto primer: [research-aifc-f2f-ru.md](research-aifc-f2f-ru.md) ([PDF](research-aifc-f2f-ru.pdf)). Placement scenarios with flows, responsibilities, licences and program roles: [scenarios-aifc-f2f-ru.md](scenarios-aifc-f2f-ru.md) ([PDF](scenarios-aifc-f2f-ru.pdf)). CC's exchange and custodian scheme with Binance KZ as custodian, farmer or F2F Proto as issuer, KZT payout to the farmer: [custody-binance-kz-ru.md](custody-binance-kz-ru.md).

## Open questions

- Legal form of the Issuer and the jurisdiction of the Instrument.
- How SCAS is operated: in-house or a third party, and who holds its key.
- Term of the Instrument relative to harvest and grain sale dates (term sheet: start and maturity TBD).
- Contractual interest start for the pilot: subscription close (platform default) or disbursement.

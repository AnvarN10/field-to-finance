# Glossary

## Act/360

Interest day count of the pilot term sheet: interest = principal × annual coupon × actual days / 360. Days are whole days from the interest start to maturity. The program floors the result to a USDC base unit.

## Application

A farmer's request to finance part of a harvest: crop, grade, volume, tokenized share, amount, proposed coupon, season, elevator and laboratory, with the term sheet documents and the registered Farm Project. It moves through the issuance pipeline to a published Pool; from `open` on its status follows the Pool on-chain. Stored in Postgres.

## Arrangement Fee

Share of a Farm Project's requested amount, in basis points per Pool, that the Producer pays for arranging the financing. Withheld on-chain at disbursement and sent to the Treasury. Set by the Issuer while the Pool is Draft, capped by FeeConfig and by the Program at 10%.

## Arranger

Field-to-Finance as the platform operator of a farmer-issued Instrument: it structures the issue and signs pool operations with the `Config.issuer` key. See [ADR 0014](architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md).

## Attestation

A statement about a Field signed by the SCAS key: the field exists with given boundaries, sowing happened, the vegetation index is in a given range, or the harvest was delivered. For delivery-settled pools the elevator receipt and the laboratory certificate are attestations too, signed by SCAS or the Arranger. The full evidence lives off-chain; its hash, the signer and the verdict are recorded on Solana.

## Buyback

The issuer's right under a Hybrid Instrument to settle in cash: the issuer elects buyback no later than maturity and funds principal plus coupon, and holders redeem their tokens for USDC.

## Cabinet

Historical (ADR 0016, ADR 0017): a role's own area of the web app. Replaced by the investor app, the issuer workspace and the console (ADR 0018); old cabinet URLs redirect.

## Console

The back office at `/console` for the arranger, compliance, the SCAS partner, the elevator, the laboratory and the regulator. Members join by invitation; what each sees and does depends on the permissions of their console roles.

## Clearing

Checking that both sides of a concluded trade can deliver and then executing the trade. In the MVP the Program does this atomically in one transaction.

## Exchange

The place where the Instrument is offered and traded. In the MVP only the Primary Market exists.

## Farm Project

One Producer's financing request for one season: fields, crop, expected yield and requested amount. Verified Farm Projects are included in a Pool.

## Field

A plot of land with a polygon boundary that a Producer owns or has the legal right to use.

## Gas Sponsor

The platform key that pays Solana transaction fees and the rent of accounts created for users, so investors and Producers need no SOL. It co-signs a user transaction only after the server checks it holds exactly the expected instructions.

## Grain Claim

The on-chain record (`GrainClaim` event) that a holder burned Instrument for a pro-rata share of the delivered grain held at the elevator under a recorded receipt. The grain is released off-chain against the receipt; later the claim maps to a grain-receipt token on CommodityChain.

## Hybrid

Settlement mode of the pilot Instrument: grain delivery at the elevator, with the issuer's right to buy the token back for cash. Without a buyback election by maturity, or if an elected buyback is not funded within 7 days after maturity, delivery applies.

## Instrument

The investment token issued for a Pool, for example `WHEAT-2027`. An investor buys the Instrument, not specific tonnes of grain from a specific farmer.

## Instrument Terms

The term-sheet terms of a Pool's Instrument, stored on-chain in the InstrumentTerms account: nominal per token, annual coupon, day count, interest start, settlement mode, volume, tokenized share, quality spec hash, elevator and laboratory.

## Issuer

The legal entity that issues the Instrument and carries the obligations under it. In the pilot the farmer is the issuer; see Issuer of Record.

## Issuer of Record

The party that issues a Pool's Instrument, stored as `Pool.issuer`. For pilot pools it is the farmer's wallet, which must have passed platform KYC; for older pools it is the platform key.

## Key Features Document

KFD. A one-page summary of a Pool's terms and main risks that an investor accepts once per Pool before the first subscription. Its SHA-256 is recorded with the acceptance; a change of terms needs a new acceptance.

## KYC Thaw

Unfreezing an investor's token account after KYC passes. Token accounts of the Instrument are created frozen by default.

## Mint Fee

Flat USDC fee (3 USDC on devnet) the Producer prepays to the Treasury when registering a Farm Project.

## NDVI

Normalized Difference Vegetation Index, computed from Sentinel-2 red and near-infrared bands. Used by SCAS to confirm sowing and track crop health.

## Network Fee

Flat USDC fee (0.50 USDC on devnet) the investor pays to the Treasury on top of each subscription. It buys no Instrument.

## Pool

A set of verified Farm Projects for one crop and season, financed by one Instrument with a fixed yield.

## Pool Status

The stage of a Pool: Draft, Open, Funded, Refunding or Redeeming. See the [program doc](systems/program.md#data-and-state).

## Primary Market

The first sale of a new Instrument. Investor money reaches farmers only through the Primary Market.

## Producer

The farmer or agricultural company that grows the harvest and receives financing.

## Program

The Field-to-Finance Solana program. In the MVP it also plays the roles of Exchange, Clearing and Registrar.

## Registrar

The record of who holds the Instrument. In the MVP this is the token ledger on Solana.

## SCAS

The independent verifier of fields and the season. It confirms fields, documents and satellite data and signs Attestations. It does not promise the harvest and does not decide who owns the Instrument.

## Secondary Market

Trading of an already issued Instrument between investors. Out of MVP scope.

## Shortfall

The harvest delivered against a Farm Project is below the tokenized volume or below the contracted quality class. See [ADR 0006](architecture/decisions/0006-pooled-instrument-and-shortfall-rules.md).

## Token Nominal

The USD amount one whole token represents (pilot: USD 100,000). Subscriptions to a pool with Instrument Terms are whole multiples of it.

## Tokenized Share

The part of a Farm Project's expected harvest that backs the Instrument. Fixed at 30% of expected harvest for MVP pools; Instrument Terms set it per pool, at most 30%.

## Treasury

The Field-to-Finance wallet named in FeeConfig; every fee goes to its USDC account.

## Acting Role

The service role a person acted as when doing a service step, recorded in `audit_log.acting_role`. An arranger acting for compliance is audited as compliance. See [ADR 0017](architecture/decisions/0017-service-role-cabinets.md).

## Lab Protocol

The laboratory's record of a delivered lot against the pool's 12-parameter quality spec: each parameter passes or fails, any fail gives the verdict Fail, any missing value Insufficient Data. Recorded on-chain as a LabQuality attestation; holders can claim grain only after a passing protocol.

## Lifecycle Board

The arranger's per-pool view of the phases (subscription, funding, season, harvest and delivery, settlement, closing) with who acts next and the arranger's button when the step is theirs.

## Regulator Registry

The regulator's read-only list of published pools with issuer, terms, status, money raised and holders, with holders, events and CSV export. BIN and IIN come from Postgres; nothing personal is on-chain.

## Service Role

A role for a party other than farmer, investor and arranger: compliance, SCAS partner, elevator, laboratory, regulator. Granted only by an arranger; each has its own cabinet. See [ADR 0017](architecture/decisions/0017-service-role-cabinets.md).

## Yield Estimate

The SCAS partner's pre-harvest estimate in tonnes per hectare, recorded as a Harvest attestation whose evidence carries the number.

## Door

A sign-up entry for one audience: `/invest/signup` opens an investor account, `/apply` and `/apply/start` open an issuer workspace for a farmer company, an invitation link opens the console. The account kind comes from the door; nobody picks a role after sign-in.

## Invitation

A single-use, 7-day link that grants console roles to one email. Only the hash of its token is stored; accepting needs the invited email's sign-in.

## Permission

One capability in the console, such as `kyc.decide` or `registry.export`. Pages, actions, routes and workflows check permissions; a console role is a named bundle of them (`src/lib/permissions.ts`).

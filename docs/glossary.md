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

A role's own area of the web app after sign-in: farmer issuer (`/farmer`), investor (`/investor`), arranger (`/arranger`).

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

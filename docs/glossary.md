# Glossary

## Attestation

A statement about a Field signed by the SCAS key: the field exists with given boundaries, sowing happened, the vegetation index is in a given range, or the harvest was delivered. The full evidence lives off-chain; its hash, the signer and the verdict are recorded on Solana.

## Clearing

Checking that both sides of a concluded trade can deliver and then executing the trade. In the MVP the Program does this atomically in one transaction.

## Exchange

The place where the Instrument is offered and traded. In the MVP only the Primary Market exists.

## Farm Project

One Producer's financing request for one season: fields, crop, expected yield and requested amount. Verified Farm Projects are included in a Pool.

## Field

A plot of land with a polygon boundary that a Producer owns or has the legal right to use.

## Instrument

The investment token issued for a Pool, for example `WHEAT-2027`. An investor buys the Instrument, not specific tonnes of grain from a specific farmer.

## Issuer

The legal entity that issues the Instrument and carries the obligations under it.

## KYC Thaw

Unfreezing an investor's token account after KYC passes. Token accounts of the Instrument are created frozen by default.

## NDVI

Normalized Difference Vegetation Index, computed from Sentinel-2 red and near-infrared bands. Used by SCAS to confirm sowing and track crop health.

## Pool

A set of verified Farm Projects for one crop and season, financed by one Instrument with a fixed yield.

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

## Tokenized Share

The part of a Farm Project's expected harvest that backs the Instrument. Fixed at 30% of expected harvest.

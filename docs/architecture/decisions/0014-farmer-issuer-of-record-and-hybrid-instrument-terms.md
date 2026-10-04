---
status: Accepted
date: "2026-10-05"
---

# Farmer as issuer of record and hybrid instrument terms

Accepted: user decision 2026-10-05.

## Context

The first pilot term sheet (`docs/business/raw/pilot-digital-asset-contract-2026-10.csv`, summary in [CONTEXT.md](../../business/CONTEXT.md#pilot-term-sheet-digital-asset-contract)) differs from the MVP instrument:

- The farmer is the issuer and passes full KYC; the offer contract is between CommodityChain and the issuer.
- Ten tokens of USD 100,000 each, a USD 1,000,000 issue.
- Interest is 5% a year on actual days / 360, not a flat yield.
- Settlement is hybrid: grain delivery at the Ust-Kamenogorsk elevator, certified by the Baltic Control laboratory against a 12-parameter quality spec, with the issuer's right to buy the token back for cash.
- 10,000 t contracted, at most 30% tokenized.

Devnet pools 1, 2 and 5 exist, so the layouts of Config, Pool, FarmProject, Field, Attestation, InvestorRecord, FeeConfig and PoolTerms must not change, and enum variants may only be appended.

## Decision

- **Issuer of record.** `Pool.issuer`, written but never read before, now names the issuer of the instrument. `set_instrument_terms` sets it to the farmer's wallet, which must hold an approved InvestorRecord (the platform KYC record). Platform operations stay signed by `Config.issuer`, now read as the arranger and platform operator. Older pools keep `Pool.issuer` = the platform key, so nothing changes for them. A farmer-issued pool takes only that farmer's projects (`add_project` checks `project.producer == pool.issuer` whenever the two keys differ), and the issuer of record cannot change once projects joined.
- **InstrumentTerms** PDA `["instrument", pool]`, a new account set by the arranger with `set_instrument_terms(args)` while the pool is Draft, in the same transaction as `create_pool`: `unit_nominal` (USDC base units), `coupon_bps_annual` (at most `MAX_COUPON_BPS` = 3,000), `day_count` (Act360; Act365 is reserved and refused), `start_ts`, `settlement_mode` (CashBuyback, GrainDelivery, Hybrid), `volume_kg`, `tokenized_share_bps` (1 to 3,000), `quality_spec_hash` and `spec_uri` (the spec JSON lives in the bucket like evidence), `elevator`, `lab` (up to 32 bytes), plus the election and delivery state written later. `create_pool` itself is unchanged, so its IDL and old clients keep working.
- **Interest start.** `start_ts` is set explicitly. The console defaults it to the subscription close: from then every investor's money is in and the instrument is issued. The term sheet leaves the dates open, so the arranger may set another contractual start (for example disbursement); the demo backdates it to show 300 days of coupon in a minutes-long run. Validation: `start_ts < maturity_ts` and at most `MAX_TERM_DAYS` = 1,830 days of interest.
- **Whole tokens.** With InstrumentTerms, `subscribe` takes only multiples of `unit_nominal`, and `open_pool` requires the target to be a whole number of tokens. One Instrument base unit is still one USDC base unit; the UI shows tokens as amount / nominal.
- **Act/360 coupon.** With InstrumentTerms, cash due for `principal` is `principal × (10,000 × 360 + coupon_bps × days) / (10,000 × 360)` in checked u128 with one floor division, where `days` is whole days from `start_ts` to `Pool.maturity_ts`. `fund_redemption` uses it for readiness on `raised_amount`, `redeem` for each payout; since the sum of floors never exceeds the floor of the sum, a vault funded to the pool-level amount pays every holder. Pilot: USD 1,000,000 at 5% for 300 days is USD 1,041,666.666666. Pools without terms keep the flat `yield_bps`.
- **Buyback funding.** `fund_redemption` may be signed by `Pool.issuer` (the farmer) or `Config.issuer`; it pays from the signer's own USDC account. On a pool with terms it accepts cash only on the buyback path (CashBuyback mode or an elected buyback); before a Hybrid election a deposit fails with `ElectionPending`, so no cash can be stranded in the vault if delivery follows.
- **Settlement election.** For Hybrid, `elect_settlement(Buyback | Delivery)` is signed by the issuer of record or the arranger, once, while the pool is Open or Funded and no later than maturity. Without an election, delivery applies after maturity, because the term sheet's default is delivery and buyback is the issuer's right. An elected buyback that is still unfunded `BUYBACK_GRACE_SECS` (7 days) after maturity lapses into delivery, so a farmer who elects buyback and defaults cannot lock holders out of the grain; a funded buyback has moved the pool to Redeeming by then. CashBuyback and GrainDelivery pools have a fixed settlement. Cash redemption (`fund_redemption` deposits and the Redeeming transition) is refused once delivery applies.
- **Delivery attestations.** `AttestationKind` gains `ElevatorReceipt` and `LabQuality`, appended at the end so stored attestations decode. They are recorded only through `record_delivery(kind, verdict, evidence_hash, evidence_uri)`, signed by SCAS or the arranger on a Field of a project in the pool; it writes a normal Attestation and copies the hash into InstrumentTerms (`receipt_hash` for a passing receipt, `lab_cert_hash` and `lab_passed` for the latest certificate). `record_attestation` refuses the delivery kinds.
- **Grain claims.** `redeem_delivery(amount)` requires delivery to apply, a Funded pool, maturity passed, every project disbursed, a recorded receipt and a passing lab certificate. It burns the investor's Instrument and emits `GrainClaim { pool, investor, amount, kg, receipt_hash }` with `kg = amount × volume_kg × tokenized_share_bps / 10,000 / raised_amount`, floored, and adds `kg` to `delivered_kg`. The pool stays Funded on this path.
- **What a Grain Claim is.** An on-chain record that the holder gave up the token for `kg` of the delivered grain held at the elevator under the receipt with `receipt_hash`. Releasing the grain happens off-chain against that receipt. Later the claim maps to a grain-receipt token on CommodityChain; this ADR does not build that bridge.
- **Documents.** The quality spec, delivery evidence JSON, farmer onboarding documents and field sets with cadastral numbers live in the bucket, keyed by SHA-256. Only hashes go on-chain; no personal data does. Farmer documents and delivery papers are served to the admin console only.

## Consequences

- Pools 1, 2 and 5 decode and behave as before; their InstrumentTerms PDA does not exist, which the program reads as "no terms" at the fixed address, so a client cannot skip the terms of a pilot pool by leaving the account out.
- `subscribe`, `redeem`, `fund_redemption` and `open_pool` take one more account. The web app, scripts and sponsor validator were updated together; clients built for the old account lists stop working after the upgrade.
- The farmer becomes the party at risk for the cash buyback, which matches the term sheet; if the farmer does not buy back, investors get grain, not cash.
- `delivered_kg` and the `GrainClaim` events are the record that the off-chain release and a future CommodityChain grain-receipt token reconcile against.
- Sweep stays with the arranger and only applies to Redeeming pools; a delivery pool has nothing to sweep. A farmer's over-deposit and the rounding dust (at most 1 base unit per redemption) go to the arranger's USDC account and are returned off-chain if due.
- Revoking the farmer's KYC does not change `Pool.issuer`; a revoked issuer can still elect and fund. Acceptable for the pilot.
- The volume on the elevator receipt is in the off-chain evidence JSON only; the program caps claims at the tokenized volume, not at the receipt.
- A Hybrid pool without an election opens grain claims one second after maturity (the election window includes maturity itself); an explicit delivery election opens them at maturity.

## Alternatives considered

- New fields on Pool: breaks the existing devnet accounts.
- Passing the issuer of record to `create_pool`: breaks `create_pool`'s IDL for every client for no gain; `set_instrument_terms` in the same transaction sets it before any project or investor can join.
- A new Pool status for delivery: changes how every client reads `PoolStatus`; the election and InstrumentTerms already say which path applies.
- Recording receipts with `record_attestation`: it cannot see InstrumentTerms, so claims could not be gated on-chain.
- A farmer co-signature on the terms: the farmer's consent is the off-chain offer contract; requiring the farmer's (embedded) wallet to sign the arranger's transaction adds a step without on-chain value for the pilot.

## Related code

- `anchor/programs/f2f/src/instructions/set_instrument_terms.rs`, `elect_settlement.rs`, `record_delivery.rs`, `redeem_delivery.rs`
- `anchor/programs/f2f/src/instrument.rs`, `math.rs` (`actual_days`, `with_coupon`), `state.rs` (`InstrumentTerms`)
- `anchor/programs/f2f/tests/test_instrument.rs`, `tests/test_layout.rs`
- `packages/sdk/src/instrument.ts`
- `apps/web/src/lib/instrument-terms.ts`, `apps/web/src/lib/pilot-docs.ts`, `apps/web/src/components/pool/term-sheet.tsx`, `apps/web/src/components/admin/term-sheet-console.tsx`
- `apps/web/src/lib/demo/pilot-flow.ts`, `scripts/demo-pilot.ts`, `scripts/devnet-seed-pilot.ts`

## Related docs

- [Program](../../systems/program.md), [Web app](../../systems/web.md), [Pool lifecycle](../../flows/pool-lifecycle.md)
- [ADR 0006](0006-pooled-instrument-and-shortfall-rules.md), [ADR 0011](0011-platform-level-kyc.md), [ADR 0013](0013-platform-fees-and-gas-sponsorship.md)
- [Legal structure](../../business/legal-structure.md)

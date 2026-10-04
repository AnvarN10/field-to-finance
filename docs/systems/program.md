# Program

## Purpose

The `f2f` Solana program holds the on-chain state of Field-to-Finance and moves money. It records Farm Projects, Fields and Attestations, issues one Instrument per Pool, sells it for USDC atomically, pays Producers, and redeems the Instrument with a fixed yield or, for pools with Instrument Terms, with an Act/360 coupon or a Grain Claim. In the MVP it plays the Exchange, Clearing and Registrar roles for the Primary Market ([ADR 0007](../architecture/decisions/0007-program-replaces-exchange-clearing-registrar.md)).

## Questions this doc answers

- Which accounts exist and how are their addresses derived?
- Who may call each instruction?
- Which state transitions can a Pool go through?
- What must be true before money moves?

## Scope

Config, Farm Projects, Fields, Attestations, Pools, Instrument mints, investor approval, subscription, disbursement, refunds, settlement records, redemption, platform fees, the rent payer for gas sponsorship, Instrument Terms with the issuer of record, settlement election, delivery attestations and Grain Claims.

## Non-scope

- Satellite processing and verdict rules: the SCAS worker decides the verdict; the program only records it.
- How the Producer repays the Issuer off-chain. The program only records which Shortfall rule applied.
- Secondary Market trading.

## Key concepts

Pool, Instrument, Farm Project, Field, Attestation, KYC Thaw, Shortfall, Tokenized Share, Issuer of Record, Arranger, Instrument Terms, Hybrid, Buyback, Grain Claim, Act/360. See the [glossary](../glossary.md).

## How the system works

Roles are keys stored in Config: admin, Issuer (the Arranger for farmer-issued pools), SCAS and compliance. `Pool.issuer` is the Issuer of Record: the platform key for older pools, the farmer's KYC-approved wallet for pools with Instrument Terms. Every privileged instruction checks its signer against Config with an `address` constraint, so one wallet may hold several roles.

The Instrument mint is a Token-2022 mint created in `create_pool`. Anchor has no constraint for the Default Account State extension, so the mint is built by hand: allocate the account with room for Default Account State and Metadata Pointer, fund rent for the metadata that is appended later, initialize both extensions, initialize the mint with the Pool PDA as mint and freeze authority, then write name, symbol and URI with `token_metadata_initialize`. Every new token account of the Instrument starts frozen. KYC is platform-level: `approve_investor` marks the wallet approved once for every Pool, and `subscribe` creates and thaws the investor's account for that Pool in the same transaction ([ADR 0011](../architecture/decisions/0011-platform-level-kyc.md)).

`subscribe` moves USDC from the investor to the Pool vault and mints the same amount of Instrument in one transaction. One Instrument base unit equals one USDC base unit.

Amounts with yield use `math::with_yield`, which computes in u128 and fails on overflow. Pools with Instrument Terms use `instrument::redemption_due`: `math::with_coupon(principal, coupon_bps, math::actual_days(start_ts, maturity_ts))`, one floor division in checked u128.

**Instrument Terms** ([ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md)). `set_instrument_terms` (Arranger, pool Draft, normally in the `create_pool` transaction) writes the InstrumentTerms account and sets `Pool.issuer` to the issuer of record, whose InvestorRecord must be approved. `subscribe`, `open_pool`, `fund_redemption` and `redeem` take the InstrumentTerms PDA as an unchecked account at its fixed address and read it only when initialized (`instrument.rs`), the same pattern as fees: subscriptions become whole tokens, the target must be whole tokens, and cash due uses the coupon. The settlement that applies is `InstrumentTerms::effective_election`: CashBuyback and GrainDelivery are fixed; Hybrid follows `elect_settlement` (issuer of record or Arranger, once, no later than maturity) and defaults to delivery after maturity. `record_delivery` writes an ElevatorReceipt or LabQuality Attestation on a field of the pool and copies its hash into InstrumentTerms; `redeem_delivery` burns Instrument for a Grain Claim once delivery applies, maturity passed, every project is disbursed and both documents are recorded.

**Fees and gas sponsorship** ([ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md)). `FeeConfig` names the treasury wallet and the flat fees; `PoolTerms` holds a pool's arrangement fee. Both are passed at their fixed PDA addresses as unchecked accounts and read only when initialized (`fees.rs`): an uninitialized FeeConfig or PoolTerms means no fee, and a client cannot swap in another address because of the seeds constraint. When a fee is due the `treasury_usdc` account must equal the USDC associated token account of `FeeConfig.treasury` (`InvalidTreasury` otherwise, `MissingFeeAccount` if absent).

- `disburse` splits `requested_amount` with `math::split_fee` (u128, rounded down for the farmer): the fee to the treasury, the rest to the producer. Emits `ArrangementFeeWithheld`.
- `subscribe` moves `network_fee` from the investor's USDC to the treasury after the vault transfer. Emits `NetworkFeeCharged`. The fee never touches the vault, `raised_amount` or supply.
- `register_project` moves `mint_fee` from the producer's USDC to the treasury. Emits `MintFeeCharged`.
- `subscribe`, `register_project` and `register_field` take a `payer` signer for the rent of accounts they create (Instrument account, project, field). The investor or producer stays the signer and authority for their own USDC and Instrument; `payer` may be the same wallet or the platform's gas sponsor.

## Important flows

- [Pool lifecycle](../flows/pool-lifecycle.md): from field registration to redemption.

## Data and state

| Account | Seeds | Holds |
| --- | --- | --- |
| Config | `config` | role keys, USDC mint |
| FarmProject | `project`, producer, project id (u64 LE) | crop, season, expected and tokenized kg, requested USDC, field counters, harvest flag, disbursed flag, settlement rule, pool |
| Field | `field`, project, index (u8) | polygon hash, area in ha × 100, verified flag, attestation counter |
| Attestation | `attestation`, field, sequence (u32 LE) | kind, verdict, evidence hash and URI, NDVI × 10 000, scene date, signer |
| Pool | `pool`, pool id (u64 LE) | crop, season, mint, vault, target and raised USDC, yield and premium bps, close and maturity times, counters, status |
| Instrument mint | `mint`, pool | Token-2022 mint with Default Account State and Token Metadata |
| Vault | associated token account of the Pool for USDC | investor money |
| InvestorRecord | `investor`, wallet | approved flag and time. No personal data. |
| FeeConfig | `fees` | treasury wallet, network fee and mint fee (USDC base units), arrangement fee cap (bps) |
| PoolTerms | `terms`, pool | arrangement fee (bps); absent for pools created before fees |
| InstrumentTerms | `instrument`, pool | nominal per token, coupon bps, day count, interest start, settlement mode, volume kg, tokenized share, quality spec hash and URI, elevator, lab, election, receipt and lab certificate hashes, lab verdict, kg claimed; absent for pools without term-sheet terms |
| Treasury USDC | associated token account of `FeeConfig.treasury` for USDC | collected fees; created by `init_fee_config` / `update_fee_config` |

Pool status:

```
Draft --open_pool--> Open --close_subscription--> Funded --fund_redemption--> Redeeming
                          \--close_subscription (under target, after close)--> Refunding
```

A pool whose settlement is delivery never reaches Redeeming: holders call `redeem_delivery` while it is Funded.

## Interfaces and entry points

| Instruction | Signer |
| --- | --- |
| `init_config(issuer, scas, compliance)` | admin |
| `register_project(project_id, crop, season, expected_kg, requested_amount)` | Producer, plus `payer` for rent |
| `register_field(polygon_hash, area_ha_x100)` | Producer, plus `payer` for rent |
| `record_attestation(kind, verdict, evidence_hash, evidence_uri, ndvi_mean_x10k, scene_date)` | SCAS |
| `create_pool(pool_id, args)` | Issuer |
| `set_instrument_terms(args)` | Issuer (Arranger), pool Draft; issuer of record's InvestorRecord approved |
| `add_project()`, `open_pool()` | Issuer |
| `approve_investor()` | compliance |
| `revoke_investor()` | compliance |
| `subscribe(amount)` | investor, plus `payer` for rent |
| `close_subscription()` | anyone |
| `disburse()` | Issuer |
| `refund(amount)` | investor |
| `record_settlement(rule)` | Issuer |
| `fund_redemption(amount)` | Issuer (Arranger) or `Pool.issuer` (issuer of record) |
| `redeem(amount)` | investor |
| `sweep()` | Issuer |
| `init_fee_config(network_fee, mint_fee, max_arrangement_bps)` | admin (`Config.admin`) |
| `update_fee_config(network_fee, mint_fee, max_arrangement_bps)` | admin; the `treasury` account becomes the new treasury |
| `set_arrangement_fee(bps)` | Issuer, pool in Draft |
| `elect_settlement(election)` | `Pool.issuer` or Issuer (Arranger); Hybrid only, once, no later than maturity |
| `record_delivery(kind, verdict, evidence_hash, evidence_uri)` | SCAS or Issuer (Arranger); kinds ElevatorReceipt, LabQuality |
| `redeem_delivery(amount)` | investor |

The IDL is generated at `anchor/target/idl/f2f.json` and TypeScript types at `anchor/target/types/f2f.ts` by `anchor build`.

## Dependencies

Token-2022 for the Instrument, SPL Token for USDC, the Associated Token Account program, the System program.

## Downstream effects

The SCAS worker and the web app build transactions from the IDL. Renaming an instruction, an account field or a seed breaks both.

## Invariants and assumptions

- `raised_amount <= target_amount`.
- While Funded, Instrument supply equals `raised_amount`.
- Tokenized volume is 30% of expected volume.
- Premium is between 500 and 600 bps.
- A Field counts as verified at most once.
- A Farm Project joins at most one Pool and gets no new Fields after that.
- Settlement is recorded at most once per project, only after disbursement and a Harvest Attestation. The one exception is `CashRepaidWithPremium` after maturity, so a missing Harvest Attestation cannot lock investor money in Funded.
- Redemption deposits are accepted only after every project is disbursed, so `disburse` never spends them.
- `sweep` returns the vault remainder to the Issuer only when the Pool is Redeeming and Instrument supply is zero.
- `revoke_investor` sets the record to not approved and freezes the investor's Instrument account in the given Pool if it exists.
- Redemption opens only when every project is disbursed and settled, maturity has passed, and the vault holds `with_yield(raised_amount, yield_bps)`.
- Arrangement fee: `PoolTerms.arrangement_fee_bps <= FeeConfig.max_arrangement_bps <= MAX_ARRANGEMENT_BPS` (1,000) at the time it is set, and it can change only while the pool is Draft. At disbursement fee + net = requested amount.
- Flat fees: `network_fee <= MAX_NETWORK_FEE` (10 USDC), `mint_fee <= MAX_MINT_FEE` (50 USDC).
- Fees go only to the USDC ATA of `FeeConfig.treasury`; without FeeConfig no fee is charged; without PoolTerms the arrangement fee is 0.
- Existing account layouts never change for fees; fee data lives in FeeConfig and PoolTerms.
- Existing account layouts never change for Instrument Terms either (`tests/test_layout.rs` pins their sizes and enum tags); new enum variants are appended only.
- With InstrumentTerms: `subscribe` amounts and the pool target are multiples of `unit_nominal`; `coupon_bps_annual <= MAX_COUPON_BPS` (3,000); `1 <= tokenized_share_bps <= 3,000`; day count Act360; `start_ts < maturity_ts` and at most 1,830 days apart; terms and issuer of record change only while Draft, and the issuer of record only while no project has joined.
- A farmer-issued pool (`Pool.issuer != Config.issuer`) holds only projects whose producer is `Pool.issuer`.
- Cash due with terms is `floor(principal × (3,600,000 + coupon_bps × days) / 3,600,000)`; per-holder payouts sum to at most the pool-level amount `fund_redemption` waits for.
- Once delivery applies, `fund_redemption` fails with `DeliveryElected`, so the pool cannot reach Redeeming; `redeem_delivery` claims sum to at most `volume_kg × tokenized_share_bps / 10,000`.
- `record_attestation` refuses ElevatorReceipt and LabQuality; only `record_delivery` writes them.

## Error handling

All failures are `F2fError` variants in `src/error.rs` or standard Anchor constraint errors. Missing InvestorRecord fails with `AccountNotInitialized`.

## Security and privacy notes

- The Pool PDA is the freeze authority, so the program can thaw any Instrument account; only `subscribe` does it, and only for a wallet whose InvestorRecord is approved by the compliance key.
- Evidence stays off-chain. Only its hash and URI are stored.
- No personal data on-chain.

## Observability and debugging

Program logs show the failing constraint or `F2fError` name. In tests, `send_err` returns the logs.

## Testing notes

Run `cd anchor && anchor build && cargo test -p f2f`. Tests are LiteSVM integration tests, one file per area, sharing the harness in `tests/common/mod.rs`.

## Common pitfalls

- `init_config` can be called by any signer once. Deploy and initialize in the same script right after deploying a fresh program id.
- Demo pools need a maturity a few minutes out, otherwise redemption cannot be shown.

- Host tests need Rust 1.97.1 (`anchor/rust-toolchain.toml`) because litesvm 0.17 pulls agave crates that require it.
- litesvm must be 0.17 or newer to load sbpf v3 programs; the 0.10 pin from the Anchor template fails with `InvalidAccountData`.
- `spl-token-metadata-interface` must be 0.8.0, the version Token-2022 interface 2.1.0 uses; 1.x types do not implement `Extension`.
- In Anchor 1.x `CpiContext::new` takes a program id, not an `AccountInfo`.
- `anchor deploy` of a larger program auto-extends the program data account; the upgrade buffer needs about 2.9 SOL of rent up front (refunded after the upgrade), so keep the deployer above 3.5 SOL.

## Source map

- [lib.rs](../../anchor/programs/f2f/src/lib.rs) — instruction list
- [state.rs](../../anchor/programs/f2f/src/state.rs) — accounts and enums
- [create_pool.rs](../../anchor/programs/f2f/src/instructions/create_pool.rs) — Instrument mint creation
- [approve_investor.rs](../../anchor/programs/f2f/src/instructions/approve_investor.rs) — KYC Thaw
- [subscribe.rs](../../anchor/programs/f2f/src/instructions/subscribe.rs) — atomic subscription
- [fund_redemption.rs](../../anchor/programs/f2f/src/instructions/fund_redemption.rs) — redemption gate
- [fees.rs](../../anchor/programs/f2f/src/fees.rs) — optional FeeConfig/PoolTerms reads and the treasury check
- [instrument.rs](../../anchor/programs/f2f/src/instrument.rs) — optional InstrumentTerms read and the cash-due formula
- [set_instrument_terms.rs](../../anchor/programs/f2f/src/instructions/set_instrument_terms.rs), [elect_settlement.rs](../../anchor/programs/f2f/src/instructions/elect_settlement.rs), [record_delivery.rs](../../anchor/programs/f2f/src/instructions/record_delivery.rs), [redeem_delivery.rs](../../anchor/programs/f2f/src/instructions/redeem_delivery.rs) — term-sheet instruments
- [tests/test_instrument.rs](../../anchor/programs/f2f/tests/test_instrument.rs), [tests/test_layout.rs](../../anchor/programs/f2f/tests/test_layout.rs) — pilot terms and layout guards
- [fee_config.rs](../../anchor/programs/f2f/src/instructions/fee_config.rs), [set_arrangement_fee.rs](../../anchor/programs/f2f/src/instructions/set_arrangement_fee.rs) — fee settings
- [tests/test_fees.rs](../../anchor/programs/f2f/tests/test_fees.rs) — fees and sponsorship
- [tests/common/mod.rs](../../anchor/programs/f2f/tests/common/mod.rs) — test harness

## Related docs

- [MVP design](../specs/2026-10-03-mvp-design.md)
- [ADR 0014](../architecture/decisions/0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md), [ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md), [ADR 0003](../architecture/decisions/0003-token-2022-frozen-accounts-kyc-thaw.md), [ADR 0006](../architecture/decisions/0006-pooled-instrument-and-shortfall-rules.md), [ADR 0007](../architecture/decisions/0007-program-replaces-exchange-clearing-registrar.md)

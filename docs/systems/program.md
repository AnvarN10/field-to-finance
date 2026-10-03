# Program

## Purpose

The `f2f` Solana program holds the on-chain state of Field-to-Finance and moves money. It records Farm Projects, Fields and Attestations, issues one Instrument per Pool, sells it for USDC atomically, pays Producers, and redeems the Instrument with a fixed yield. In the MVP it plays the Exchange, Clearing and Registrar roles for the Primary Market ([ADR 0007](../architecture/decisions/0007-program-replaces-exchange-clearing-registrar.md)).

## Questions this doc answers

- Which accounts exist and how are their addresses derived?
- Who may call each instruction?
- Which state transitions can a Pool go through?
- What must be true before money moves?

## Scope

Config, Farm Projects, Fields, Attestations, Pools, Instrument mints, investor approval, subscription, disbursement, refunds, settlement records and redemption.

## Non-scope

- Satellite processing and verdict rules: the SCAS worker decides the verdict; the program only records it.
- How the Producer repays the Issuer off-chain. The program only records which Shortfall rule applied.
- Secondary Market trading.

## Key concepts

Pool, Instrument, Farm Project, Field, Attestation, KYC Thaw, Shortfall, Tokenized Share. See the [glossary](../glossary.md).

## How the system works

Roles are keys stored in Config: admin, Issuer, SCAS and compliance. Every privileged instruction checks its signer against Config with an `address` constraint, so one wallet may hold several roles.

The Instrument mint is a Token-2022 mint created in `create_pool`. Anchor has no constraint for the Default Account State extension, so the mint is built by hand: allocate the account with room for Default Account State and Metadata Pointer, fund rent for the metadata that is appended later, initialize both extensions, initialize the mint with the Pool PDA as mint and freeze authority, then write name, symbol and URI with `token_metadata_initialize`. Every new token account of the Instrument starts frozen. KYC is platform-level: `approve_investor` marks the wallet approved once for every Pool, and `subscribe` creates and thaws the investor's account for that Pool in the same transaction ([ADR 0011](../architecture/decisions/0011-platform-level-kyc.md)).

`subscribe` moves USDC from the investor to the Pool vault and mints the same amount of Instrument in one transaction. One Instrument base unit equals one USDC base unit.

Amounts with yield use `math::with_yield`, which computes in u128 and fails on overflow.

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

Pool status:

```
Draft --open_pool--> Open --close_subscription--> Funded --fund_redemption--> Redeeming
                          \--close_subscription (under target, after close)--> Refunding
```

## Interfaces and entry points

| Instruction | Signer |
| --- | --- |
| `init_config(issuer, scas, compliance)` | admin |
| `register_project(project_id, crop, season, expected_kg, requested_amount)` | Producer |
| `register_field(polygon_hash, area_ha_x100)` | Producer |
| `record_attestation(kind, verdict, evidence_hash, evidence_uri, ndvi_mean_x10k, scene_date)` | SCAS |
| `create_pool(pool_id, args)` | Issuer |
| `add_project()`, `open_pool()` | Issuer |
| `approve_investor()` | compliance |
| `revoke_investor()` | compliance |
| `subscribe(amount)` | investor |
| `close_subscription()` | anyone |
| `disburse()` | Issuer |
| `refund(amount)` | investor |
| `record_settlement(rule)` | Issuer |
| `fund_redemption(amount)` | Issuer |
| `redeem(amount)` | investor |
| `sweep()` | Issuer |

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

## Source map

- [lib.rs](../../anchor/programs/f2f/src/lib.rs) — instruction list
- [state.rs](../../anchor/programs/f2f/src/state.rs) — accounts and enums
- [create_pool.rs](../../anchor/programs/f2f/src/instructions/create_pool.rs) — Instrument mint creation
- [approve_investor.rs](../../anchor/programs/f2f/src/instructions/approve_investor.rs) — KYC Thaw
- [subscribe.rs](../../anchor/programs/f2f/src/instructions/subscribe.rs) — atomic subscription
- [fund_redemption.rs](../../anchor/programs/f2f/src/instructions/fund_redemption.rs) — redemption gate
- [tests/common/mod.rs](../../anchor/programs/f2f/tests/common/mod.rs) — test harness

## Related docs

- [MVP design](../specs/2026-10-03-mvp-design.md)
- [ADR 0003](../architecture/decisions/0003-token-2022-frozen-accounts-kyc-thaw.md), [ADR 0006](../architecture/decisions/0006-pooled-instrument-and-shortfall-rules.md), [ADR 0007](../architecture/decisions/0007-program-replaces-exchange-clearing-registrar.md)

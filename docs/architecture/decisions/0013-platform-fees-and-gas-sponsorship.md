---
status: Accepted
date: "2026-10-04"
---

# Platform fees and gas sponsorship

## Context

The legal structure draft (docs/business/legal-structure.md, Fees) lists three product fees decided by the user on 2026-10-04: an arrangement fee paid by the farmer, a network fee paid by the investor, and a mint fee paid by the farmer at registration. Until now users also needed devnet SOL for transaction fees and rent, which the faucet handed out. Investors and farmers should only ever need USDC.

Devnet pools 1 and 2 already exist, so existing account layouts (Config, Pool, FarmProject, Field, Attestation, InvestorRecord) must not change.

## Decision

- **New accounts, old layouts untouched.** `FeeConfig` (PDA `["fees"]`, controlled by `Config.admin`): treasury wallet, `network_fee`, `mint_fee` (USDC base units), `max_arrangement_bps`. `PoolTerms` (PDA `["terms", pool]`): `arrangement_fee_bps`. Instructions `init_fee_config`, `update_fee_config` (admin) and `set_arrangement_fee` (Issuer, pool in Draft, bps at most `FeeConfig.max_arrangement_bps` and the hard cap `MAX_ARRANGEMENT_BPS` = 1,000). Flat fees have hard caps too: 10 USDC network fee, 50 USDC mint fee.
- **Arrangement fee.** `disburse` withholds `requested * bps / 10_000` (u128, rounded down in the farmer's favour) to the treasury's USDC ATA and pays the rest to the producer. A pool without PoolTerms (pools 1 and 2) has a zero fee.
- **Network fee.** `subscribe` moves `network_fee` from the investor's USDC to the treasury in the same transaction, on top of the amount. It never reaches the vault, `raised_amount` or the Instrument supply.
- **Mint fee.** `register_project` moves `mint_fee` from the producer's USDC to the treasury.
- **Fees cannot be skipped.** FeeConfig and PoolTerms are passed at their fixed PDA addresses (seeds constraints) and read only if initialized, so a client cannot omit them to dodge a fee; when a fee is due the treasury account must be exactly the USDC ATA of `FeeConfig.treasury`.
- **Gas sponsorship.** `subscribe`, `register_project` and `register_field` take a separate `payer` signer for rent. The web server builds user transactions with the sponsor key (`F2F_SPONSOR_KEYPAIR`) as fee payer and rent payer. The wallet signs only; `/api/tx/send` validates the signed transaction (only the expected f2f instructions for that action plus a bounded compute budget, expected accounts, sponsor only as fee payer and `payer`, exactly two signers, no lookup tables) before adding the sponsor signature and submitting with preflight.
- **Faucet.** The SOL top-up is off unless `FAUCET_SOL=true`; the faucet gives test USDC to any wallet, investor or farmer.
- **Disclosure** (COB 4.4): the invest panel shows amount + network fee = total and says no SOL is needed; farmer registration shows the mint fee and the arrangement fee cap before signing; the Instrument card shows the pool's arrangement fee and the farmer's net amount.

## Consequences

- Investors and farmers need no SOL. The sponsor pays about 5,000 lamports per transaction plus rent for each new Instrument account (~0.002 SOL), project and field accounts. Its balance is shown in the admin console; `/api/tx/send` is rate-limited per IP and globally.
- Fee amounts are admin-tunable on-chain without a program upgrade; the arrangement fee is fixed per pool once it opens.
- Old clients built for the previous account lists stop working after the upgrade; the web app and scripts were updated together.
- A user could still pay their own gas by building a transaction with `payer` = themselves; the program allows it and still charges every fee.

## Alternatives considered

- New fields on Pool and Config: breaks deserialization of the existing devnet pools.
- Optional `Option<Account<FeeConfig>>`: a client could omit the account and skip the fee. Fixed-address unchecked PDAs avoid that while keeping old deployments working.
- Sponsor signing at build time and the wallet sending: the server would sign a message it never sees again, and wallets may alter fee payer or priority fees. Signing after the wallet, on the exact bytes that get submitted, is stricter.

## Related code

- `anchor/programs/f2f/src/instructions/fee_config.rs`, `set_arrangement_fee.rs`, `disburse.rs`, `subscribe.rs`, `register_project.rs`, `register_field.rs`
- `anchor/programs/f2f/src/fees.rs`, `math.rs`
- `apps/web/src/lib/chain/sponsor.ts`, `apps/web/src/app/api/tx/send/route.ts`
- `scripts/devnet-init-fees.ts`

## Related docs

- [Program](../../systems/program.md), [Web app](../../systems/web.md), [Legal structure](../../business/legal-structure.md)

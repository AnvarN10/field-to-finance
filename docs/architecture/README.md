# Architecture

Cross-system structure and long-lived constraints of Field-to-Finance. How a single system works belongs in [../systems/](../systems/); behavior across systems belongs in [../flows/](../flows/).

## Shape of the MVP

- **Solana program (Anchor).** Holds Pools, Farm Projects and Attestation records. Acts as Exchange, Clearing and Registrar for the Primary Market: USDC in and Instrument out happen in one atomic transaction. See [ADR 0007](decisions/0007-program-replaces-exchange-clearing-registrar.md).
- **Instrument mint (Token-2022).** One mint per Pool with frozen-by-default accounts; KYC thaws them. See [ADR 0003](decisions/0003-token-2022-frozen-accounts-kyc-thaw.md).
- **SCAS worker.** Pulls Sentinel-2 data for registered Fields, computes NDVI, stores evidence off-chain and signs Attestations recorded by the Program. See [ADR 0008](decisions/0008-scas-sentinel2-signed-attestations.md). Language is open: [ADR 0009](decisions/0009-worker-language.md).
- **Web app (Next.js).** Farmer, investor, SCAS and admin views. Investors connect their own wallet; farmers get an embedded email wallet. See [ADR 0005](decisions/0005-wallet-model.md).

## System-wide constraints

- Money is USDC on Solana; the UI shows USD only. See [ADR 0004](decisions/0004-usdc-settlement-usd-display.md).
- Role separation is enforced by keys: Producer, SCAS, Issuer and admin sign with different keys, and the Program checks the signer for each instruction.
- Evidence is off-chain and content-addressed; the chain stores hashes, verdicts and money movements.

## Decisions

See [decisions/README.md](decisions/README.md).

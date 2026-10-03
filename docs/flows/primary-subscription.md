# Primary subscription

## Purpose

An investor gets verified once and buys a Pool's Instrument with USDC in one transaction. This is the demo's compliance beat: a wallet without KYC cannot get the Instrument.

## Trigger

The investor presses Subscribe on an Open pool's page.

## Participants

Investor wallet (Phantom), web app (`/api/tx/subscribe`, `/api/tx/confirm`, `/api/kyc`, `/api/faucet`), compliance key on the server, the Program, Token-2022, devnet.

## Step-by-step flow

1. The investor connects a devnet wallet. The invest panel reads `/api/investor/<wallet>`: KYC status, test USDC, positions.
2. Optional: "Get 1,000 test USDC" posts to `/api/faucet`; the deployer mints test USDC and tops up SOL.
3. The investor enters an amount up to the pool's remaining capacity and presses Subscribe.
4. The server builds `subscribe(amount)` and simulates it.
   - No InvestorRecord: simulation fails with `AccountNotInitialized` on `investor_record`. The panel shows "This wallet hasn't passed KYC" with "Complete KYC". The wallet never opens.
5. KYC: the mock form posts to `/api/kyc`. The server validates and discards the values and signs `approve_investor` with the compliance key. One approval covers every pool ([ADR 0011](../architecture/decisions/0011-platform-level-kyc.md)).
6. Subscribe again. Simulation passes; the wallet signs and sends. In one transaction the Program creates the investor's Token-2022 Instrument account if needed, thaws it because the record is approved, moves USDC to the vault and mints the same amount of Instrument.
7. The browser posts the signature to `/api/tx/confirm`; the server confirms, clears its read cache, and the panel shows the explorer link.

## Data and state changes

InvestorRecord created or set approved (step 5); Instrument account created and thawed, USDC moved, Instrument minted, `raised_amount` increased (step 6).

## Success behavior

The investor holds Instrument equal to the USDC paid; the pool page shows the new raised amount.

## Failure behavior

- `InvestorNotApproved` (revoked): same KYC message.
- `ExceedsTarget`, `SubscriptionClosed`, `PoolNotOpen`: plain messages; the amount field is pre-checked against remaining capacity.
- Missing USDC or SOL: "Get test funds".
- Wallet on mainnet: "Your wallet is on a different network".
- Cancelled signature: nothing sent.

## External dependencies

Devnet RPC, Phantom or another Wallet Standard wallet, Railway (web app).

## Invariants and assumptions

- `raised_amount <= target_amount`.
- A wallet without an approved record never holds a thawed Instrument account.

## Security and privacy notes

Compliance signs on the server only. No personal data is stored on-chain or in the app.

## Observability and debugging

PostHog `tx_failed` with `code=KycRequired` counts the demo beat; GlitchTip catches server errors. Program logs are behind "Program logs" in the error panel.

## Testing notes

`test/explain.test.ts`, `test/user-tx.test.ts`, `test/invest-panel.test.tsx`; `pnpm demo` scenes for Bob (no KYC) and Alice.

## Source map

- [invest-panel.tsx](../../apps/web/src/components/pool/invest-panel.tsx)
- [user-tx.ts](../../apps/web/src/lib/chain/user-tx.ts)
- [api/kyc/route.ts](../../apps/web/src/app/api/kyc/route.ts)
- [explain.ts](../../apps/web/src/lib/chain/explain.ts)

## Related docs

- [Web app](../systems/web.md), [Program](../systems/program.md), [Pool lifecycle](pool-lifecycle.md)

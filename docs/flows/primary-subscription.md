# Primary subscription

## Purpose

An investor gets verified once and buys a Pool's Instrument with USDC in one transaction. This is the demo's compliance beat: a wallet without KYC cannot get the Instrument.

## Trigger

The investor presses Subscribe on an Open pool's page.

## Participants

Investor wallet (Phantom, or the Privy email wallet inside the investor app), web app (`/api/tx/subscribe`, `/api/tx/send`, `/api/tx/confirm`, `/api/faucet`, the investor app), compliance and gas-sponsor keys on the server, the Program, Token-2022, devnet.

## Step-by-step flow

1. The investor connects a devnet wallet. The invest panel reads `/api/investor/<wallet>`: KYC status, test USDC, positions.
2. Optional: "Get 1,000 test USDC" posts to `/api/faucet`; the deployer mints test USDC. No SOL is needed ([ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md)).
3. The investor enters an amount up to the pool's remaining capacity. The panel shows amount, the network fee (0.50 USDC on devnet) and the total, and checks the wallet's USDC covers the total. The button reads "Subscribe · <total>".
4. The server builds `subscribe(amount)` with the gas sponsor as fee payer and rent payer and the FeeConfig/treasury accounts, and simulates it.
   - Before building, the subscribe gate ([ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md)) needs the wallet linked to an onboarded investor account with this pool's key features document accepted; otherwise the panel shows "Finish onboarding" or "Read the key features", which open the investor app.
   - No InvestorRecord: simulation fails with `AccountNotInitialized` on `investor_record`. The panel shows "This wallet hasn't passed KYC" with "Complete KYC". The wallet never opens.
5. KYC: [investor onboarding](investor-onboarding.md) in the investor app; an arranger approves and the compliance key signs `approve_investor` for each linked wallet. One approval covers every pool ([ADR 0011](../architecture/decisions/0011-platform-level-kyc.md)). `/api/kyc` answers 410.
6. Subscribe again. Simulation passes; the wallet signs only. The browser posts the signed transaction to `/api/tx/send`; the server validates it (sponsor validator), adds the sponsor's fee-payer signature and submits. In one transaction the Program creates the investor's Token-2022 Instrument account if needed (rent paid by the sponsor), thaws it because the record is approved, moves USDC to the vault, moves the network fee to the treasury and mints Instrument equal to the amount.
7. The browser posts the signature to `/api/tx/confirm`; the server confirms, clears its read cache, and the panel shows the explorer link.

## Data and state changes

InvestorRecord created or set approved (step 5); Instrument account created and thawed, USDC moved, network fee moved to the treasury, Instrument minted, `raised_amount` increased by the amount only (step 6).

## Success behavior

The investor holds Instrument equal to the USDC paid; the pool page shows the new raised amount.

## Failure behavior

- `InvestorNotApproved` (revoked): same KYC message.
- `ExceedsTarget`, `SubscriptionClosed`, `PoolNotOpen`: plain messages; the amount field is pre-checked against remaining capacity.
- Not enough USDC for amount plus fee: blocked in the panel with the faucet; on-chain "Not enough test USDC".
- Sponsor validator rejects the signed transaction: 400, nothing signed or sent.
- Sponsor out of SOL: "Gas sponsorship is out of devnet SOL"; nothing charged.
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

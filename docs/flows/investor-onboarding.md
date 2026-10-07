# Investor onboarding

## Purpose

An investor is categorized, passes a KYC check decided by an arranger, acknowledges the risks, links a wallet, and accepts each pool's key features document (KFD) before the first subscription to it.

## Trigger

An investor opens `/invest/signup` ("Start investing"), or follows "Complete KYC" from a pool page; the door opens the investor account right after email sign-in (`openAccount`, no role choice).

## Participants

Investor (Privy email login; Phantom or another Wallet Standard wallet optional), web app (`/invest` app, `app/(app)/invest/actions.ts`, `/api/tx/subscribe`), Postgres, an arranger (KYC queue), the compliance key, the Program.

## Step-by-step flow

1. Sign-in creates the account and records the Privy embedded wallet. Role choice: investor.
2. Category (`/invest/account`): professional, retail or institutional, net assets range, experience, and why the investor qualifies (not needed for retail). Retail investors see the exempt-offer limits: fewer than 50 retail investors in 12 months, USD 100,000 minimum per investor, up to USD 5M from retail investors in 12 months.
3. Identity check (mock KYC): full name and country, kept in `investor_profiles.questionnaire`; status `pending`.
4. Risk acknowledgement.
5. Wallet: the Privy email wallet is linked automatically. A Phantom wallet is linked by signing a message that names the wallet, the account and the time (valid for 10 minutes; no transaction, no fee). A wallet can belong to one account only.
6. The arranger reviews the queue (`/console/investors`) and approves: compliance signs `approve_investor` for every linked wallet; wallets linked later are approved when linked.
7. KFD: on `/invest/pools/<poolId>` the investor reads the key features (issuer of record, instrument type, nominal, issue size, coupon, grain behind the token, dates, settlement, fees, main risks) and accepts. The server computes the KFD's SHA-256 from the pool's on-chain terms and stores it in `kfd_acceptances`. Only fixed terms go into the document, so the hash changes only when the terms change.
8. Subscribe on the same page (email wallet or connected Phantom) or on the public pool page (Phantom). `/api/tx/subscribe` checks, before building: the wallet is linked (`WalletNotLinked`), the owner is onboarded (`OnboardingIncomplete`), the KFD for this pool is accepted (`KfdRequired`). Then the [primary subscription](primary-subscription.md) runs.

## Data and state changes

`investor_profiles`, `wallets`, `kfd_acceptances`, `audit_log` (`investor_kyc.*`, `wallet.link`, `kfd.accept`, `tx.subscribe`), `notifications`; on-chain InvestorRecord per wallet.

## Success behavior

The investor app shows "Onboarding complete"; the portfolio lists positions with accrued coupon, maturity schedule, settlement path, grain claims, history and a CSV statement.

## Failure behavior

- A rejected KYC shows the arranger's reason and the form again.
- A wallet already linked elsewhere: "This wallet is linked to another account."
- A signature for another wallet, account or an expired message: "The signature does not match this wallet."
- Subscribe gate errors open the onboarding or KFD page from the invest panel ("Finish onboarding", "Read the key features").
- Postgres down: subscriptions pause with "Subscriptions are paused"; refunds, redemptions and grain claims still work.

## External dependencies

Privy, Railway Postgres, devnet RPC, the compliance key's SOL.

## Invariants and assumptions

- No subscription is built for a wallet without a current KFD acceptance by its owner.
- KYC approval writes the on-chain record before the profile becomes `approved`.

## Security and privacy notes

Name and country stay in Postgres; analytics get no personal data. The wallet link message is checked with Ed25519 on the server (`src/lib/wallet-link.ts`).

## Observability and debugging

Arranger KYC queue, audit log, the investor's onboarding page (step states).

## Testing notes

`test/workflow-investor.test.ts`, `test/investor-actions.test.ts`, `test/routes/subscribe-gate.test.ts`, `test/kfd.test.ts`, `test/investor-cabinet.test.tsx`, `test/routes/statement.test.ts`.

## Source map

- [src/lib/workflow/investor.ts](../../apps/web/src/lib/workflow/investor.ts)
- [src/lib/kfd.ts](../../apps/web/src/lib/kfd.ts)
- [src/app/investor/](../../apps/web/src/app/(app)/invest/)
- [src/app/api/tx/[action]/route.ts](../../apps/web/src/app/api/tx/[action]/route.ts) — subscribe gate

## Related docs

[Primary subscription](primary-subscription.md), [Data](../systems/data.md), [ADR 0011](../architecture/decisions/0011-platform-level-kyc.md), [ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md)

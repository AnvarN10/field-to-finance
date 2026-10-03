# Legal and money-flow structure (draft for counsel)

Status: working draft, 2026-10-04. Not legal advice. Sources: AIFC rulebooks (GEN v20, GLO v23, MAR v13, AMI v11, COB v17, DAA v5, CIS v8, FSFR v12), AFSA public register, National Bank of RK notices, all retrieved 2026-10-04. [V] verified in primary text, [I] inference, [?] unverified.

## Parties as proposed by the team

| Party | Role |
| --- | --- |
| CC Tech | 100% UBO of F2F Proto; owns the platform IP; white-label technical provider |
| F2F Proto | AIFC company; operates the platform and is the issuer of the pool tokens (team decision) |
| Exchange / custodian | CCX (team says: Operating an Exchange + Operating a Clearing House), alternatives Binance Kazakhstan, Bybit Kazakhstan |
| Investors | Professional Clients, institutions, up to 50 Retail Clients per 12 months |
| Farmers | RK-resident legal entities outside AIFC |
| SCAS | external verification provider (stub in the MVP) |

## Findings that change the plan

1. **Binance KZ and Bybit KZ cannot list or custody our token.** Their AFSA licences (BN KZ Technologies Limited, AFSA-A-LA-2024-0028; Bybit Limited, AFSA-A-LA-2024-0027) cover Digital Assets only (Binance also futures and options). Our token is a Security Token, an Investment Token, which the Glossary excludes from Digital Asset; a DATF may admit only Digital Assets (DAA 2.8). [V+I] Their broker functions (Dealing as Agent/Principal) are also limited to Digital Assets. They remain useful as **USDC/USDT ↔ KZT ramps**, not as the token venue.
2. **The token venue must be an Authorised Market Institution (Operating an Exchange), or the token stays off-exchange.** AIX is one; CCX was not found in the AFSA authorised, DASP or AMI lists on 2026-10-04 [V]. BigONE Investment Ltd. holds Operating an Exchange and Operating a Clearing House inside the FinTech Lab (AFSA-G-LA-2023-0008) [V]; check whether CCX operates under that or another entity.
3. **An AMI trading Investment Tokens must use permissioned DLT access** (AMI 2-1.1.1(a)) [V]. Public Solana or TRON with a KYC-gated token needs an explicit case to AFSA [I].

## Licences by function (exact AFSA names)

| Function | Licence (GEN Sch.1 / Sch.4) | Base capital (AFSA pages) | Who in our plan |
| --- | --- | --- | --- |
| Issuing own debt token | none; offer rules FSFR s.60, MAR 1.1.2 | — | F2F Proto |
| Primary placement on our site, taking subscriptions | Arranging Deals in Investments (p.11); Dealing in Investments as Agent (p.2) | USD 10k; 50k | F2F Proto (team decision: our site with a licence) |
| Recommending a pool | Advising on Investments (p.10) | 10k | avoid, or F2F Proto |
| Holding investor tokens or money | Providing Custody (p.5); or Arranging Custody (p.6) with a licensed custodian | 500k; 10k | custodian; F2F Proto arranges |
| Many farm issuers on one platform | Operating a Loan Crowdfunding Platform (Sch.4 p.4) — allows loans and Debentures (AMI 7.2.2(2)) | 6+6 months opex | alternative path |
| Exchange and clearing | Operating an Exchange (Sch.4 p.1); Operating a Clearing House (Sch.4 p.2) | 6+6 months opex | CCX / AIX |
| Crypto venue | Operating a Digital Asset Trading Facility (Sch.1 p.30) | max(200k; 12 months opex) | Binance KZ, Bybit KZ, ATAIX (ramps) |
| Fiat flows | Providing Money Services (p.21); exempt when a necessary part of another licensed activity (21-1(a)) | max(50k; expenses) | ramp partner |
| Pooled scheme | Managing a Collective Investment Scheme (p.4) | 50k–500k | only if the token is recharacterised as a fund unit |
| Lending to farmers | Providing Credit (p.18) | [?] | F2F Proto; confirm with counsel, plus RK rules |

Offer without a prospectus (MAR 1.1.2): Professional Clients only; fewer than 50 Retail Clients in 12 months; USD 100k minimum per investor; up to USD 5M from retail in 12 months; or via an authorised crowdfunding platform. No general advertising; notify AFSA within 30 days. [V]

## Placement options

| Option | How | Licences | Status |
| --- | --- | --- | --- |
| A. Our site with F2F Proto licence | subscription in our UI, as in the MVP | F2F Proto: Arranging + Dealing as Agent; custody via licensed custodian (Arranging Custody) | **chosen for now** |
| B. Exchange primary market | subscription on CCX/AIX under its AMI licence; our site is a showcase and data layer | none for F2F Proto beyond issuer offer rules | alternative |
| C. Loan Crowdfunding Platform | F2F Proto licensed as a Loan CF platform; farmers or farm SPVs as issuers | Operating a Loan Crowdfunding Platform | alternative for scale |
| D. FinTech Lab | test A or C under AFSA sandbox limits | sandbox authorisation | alternative for the pilot |
| E. Partner licensed firm | an existing AIFC broker places the token for us | partner's Arranging/Dealing | fastest fallback |

## Accounts, custody and the master/sub model

- **Default custody on a venue, optional withdrawal to own wallet** (team decision). For the security token this venue must be an AMI or a licensed custodian, not a DATF.
- **Master/sub accounts.** A F2F master account at a venue is lawful only if F2F holds Dealing as Agent plus Providing Custody or Arranging Custody; the venue sees F2F as one client, and F2F keeps per-investor sub-ledgers under COB 8.3 [I]. A pool-level sub-sub ledger is fine as internal accounting if reconciliation reaches each end investor [I].
- **Rules:** pooled Client Money and client Investment accounts are allowed (COB 8.2.6(b), 8.3.6(b)); monthly reconciliation, weekly for Digital Assets; a DATF must keep separate client wallets and reconcile daily (DAA 2.13.7); an AMI must identify and segregate Investment Tokens per client (AMI 2-1.3.1). [V]
- **Institutions:** master account with sub-accounts per fund or client; KYB once at master level, the institution or its broker owns KYC of its clients. On-chain, the program approves the institution's wallets (platform-level KYC record).

## Money flows

Pilot: crypto on both ends. Target: fiat on both ends. Both supported.

1. **Investor in.** Crypto: USDC from own wallet or venue account. Fiat: KZT/USD to a DATF ramp (Binance KZ via Freedom Bank and Kazpost [?], Bybit KZ via Bank CenterCredit [?]), converted to USDC, then subscribed.
2. **Subscription.** Investor pays amount + fixed network fee in USDC; platform fee payer sponsors SOL/TRX gas.
3. **Disbursement.** Program pays the farmer the requested amount minus the arrangement fee (to F2F treasury) — fee disclosed up front (COB 4.4, Sch.2 p.1(e)); paying out only after the target is reached (as AMI 7.3.22 requires for crowdfunding) is already how the program works.
4. **Farmer out.** Crypto: USDC to the farmer's Privy wallet. Fiat (recommended target): F2F Proto converts USDC to KZT on a licensed DATF into its corporate account at an RK second-tier bank and pays the farmer in KZT under a KZT loan agreement, so the farmer never touches crypto and no FX operation between residents arises [I; tax and currency control to confirm].
5. **Redemption.** Mirror image: farmer repays KZT or USDC to F2F Proto, F2F Proto funds the vault in USDC, investors redeem.

USDT, USDC, SOL and TRX are on the National Bank of RK list of permitted unsecured digital assets (28.04.2026) [V]. A fiat stablecoin on a DATF needs AFSA approval (DAA 2.8.1(3)(b)) [V].

## Fees (product decisions)

| Fee | Payer | Mechanism | Status |
| --- | --- | --- | --- |
| Arrangement fee | farmer | withheld on-chain at disbursement, per-pool bps with a program-enforced cap | implemented on devnet ([ADR 0013](../architecture/decisions/0013-platform-fees-and-gas-sponsorship.md)); cap 10%, size TBD (demo 2%) |
| Network fee | investor | fixed USDC amount added to each subscription; platform sponsors gas | implemented on devnet; 0.50 USDC (admin-tunable), amount TBD |
| Mint fee (~USD 3) | farmer | prepaid in USDC at project registration; platform sponsors rent | implemented on devnet; 3 USDC |

All three fees go to the F2F treasury wallet named in the on-chain FeeConfig. Investors and farmers need no SOL: a platform sponsor key pays transaction fees and account rent.

## Chains

Team decision: issue on Solana and also on TRON (for CCX). TRON has no Token-2022 equivalent: KYC must be a whitelist in a TRC-20 contract, and two registries must stay in sync. Needs its own design before implementation.

## Open questions for AIFC counsel

1. Under which entity and licence does CCX operate (CCX not in the AFSA register on 2026-10-04)?
2. Can F2F Proto be issuer, placement agent (Arranging/Dealing) and lender at once; conflicts and disclosure?
3. Does the single-issuer debt exclusion (CIS 3.13) hold, or is F2F Proto a closed-ended investment company?
4. Providing Credit to RK farmers: AIFC licence, RK licence, or neither when structured as a KZT loan from an AIFC entity?
5. Will AFSA accept public Solana/TRON with on-chain KYC gating under AMI 2-1.1.1(a) "permissioned access"?
6. USDC settlement inside the placement: who must hold client USDC, and is a separate custodian needed when F2F only arranges?
7. Tax and currency control for the KZT loan and repayment.

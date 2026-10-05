# Compliance review

## Purpose

Compliance decides who may issue and who may invest: issuer KYC for the farmer's company, investor KYC with categorization, revocations, and the retail limits of the exempt offer.

## Trigger

A farmer submits issuer KYC ([farmer onboarding](farmer-onboarding.md)) or an investor submits mock KYC ([investor onboarding](investor-onboarding.md)).

## Participants

Compliance (`/compliance`, or an arranger acting as compliance), the compliance key, Postgres, the Program.

## Step-by-step flow

1. **Issuer KYC** (`/compliance`): legal name, BIN, region, contact and the KYC file (`/api/documents/<hash>`, served to compliance for `kyc` documents only). Approve: the compliance key signs `approve_investor` for the farmer's issuer wallet (`kyc_wallet`). Reject: a reason the farmer sees.
2. **Investor KYC** (`/compliance/investors`): category and questionnaire, name, country, optional IIN, risk acknowledgement, wallets. Approve: `approve_investor` for every linked wallet (later links are approved when linked). Reject with a reason.
3. **Revocation**: an approved investor can be revoked with a reason. `revoke_investor` runs for every linked wallet in each pool where it holds the Instrument (or one pool when it holds none), freezing those accounts; the profile becomes rejected with "Revoked: <reason>" and the investor is notified.
4. **Retail limits** (`/compliance/limits`): per pool, distinct retail subscribers against fewer than 50, amounts against the USD 100,000 minimum and retail total against USD 5M, from confirmed subscriptions (`tx.subscribe` audit rows). It is a monitor; it does not block subscriptions.

The arranger cabinet keeps a read view of investor KYC; the application page links to the compliance cabinet while issuer KYC is pending.

## Data and state changes

`farmer_profiles` and `investor_profiles` KYC fields; `audit_log` rows `farmer_kyc.*`, `investor_kyc.*` with `acting_role = compliance`; notifications; on-chain InvestorRecord and frozen Instrument accounts on revocation.

## Success behavior

Approved issuers can be structured; approved investors accept a pool's key features document and subscribe.

## Failure behavior

A user without the compliance role (and not an arranger) gets "Your account does not have the compliance role." and nothing is signed. Rejections and revocations need a reason of at least 3 characters. Chain errors appear in plain language and in the audit log.

## External dependencies

Devnet RPC, the compliance key's SOL, Postgres.

## Invariants and assumptions

- KYC is decided only by the compliance role or an arranger acting as compliance; the audit row names the role.
- Personal data (names, BIN, IIN) stays in Postgres.

## Edge cases

- An investor with no linked wallet is approved in Postgres; the on-chain approval happens when a wallet is linked.
- Revoking twice is refused (only an approved KYC can be revoked).

## Observability

`/arranger/audit` and `/regulator/events` (the latter without notes).

## Related docs

[ADR 0017](../architecture/decisions/0017-service-role-cabinets.md), [ADR 0011](../architecture/decisions/0011-platform-level-kyc.md), [Data](../systems/data.md)

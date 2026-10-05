# Role cabinets design

Status: approved scope by the user on 2026-10-05 (roles, login model, storage). This spec turns the single admin console and two thin user pages into three role cabinets for the devnet pilot.

## 1. Goals

1. Each role has its own cabinet with a clear path: farmer-issuer from application to closing, investor from onboarding to redemption, arranger from incoming application to settlement.
2. Everyone signs in with email through Privy; service roles are assigned, not shared behind one password.
3. Off-chain workflow data (profiles, applications, KYC answers, document metadata, statuses, audit log) lives in Postgres on Railway. Documents stay in the bucket; the chain keeps money, rights, hashes and attestations.

Out of scope for this iteration: separate compliance, SCAS, elevator/lab and regulator cabinets (their actions stay inside the arranger cabinet), email notifications (in-app only), real KYC provider.

## 2. Roles and access

| Role | Who | Cabinet |
| --- | --- | --- |
| farmer | farmer company representative; issuer of record of its pool | `/farmer` |
| investor | professional, retail or institutional investor | `/investor` (replaces `/portfolio`) |
| arranger | F2F operations team; also acts as compliance and SCAS-stub operator in this iteration | `/arranger` (replaces `/admin`) |

- Sign-in: Privy email for all roles. Investors may additionally connect Phantom; farmers use the Privy embedded Solana wallet.
- Server verifies the Privy access token with `PRIVY_APP_SECRET` on every protected request and loads roles from Postgres.
- Bootstrap: emails in `ARRANGER_EMAILS` (Infisical/Railway) get the arranger role on first sign-in. Arrangers assign roles by email in the cabinet.
- A new user chooses "I am a farmer" or "I am an investor"; the role is granted immediately, onboarding gates what they can do.
- The legacy `ADMIN_PASSWORD` login is removed. Basic auth (ADR 0015) stays in front of the whole platform during the pilot.
- Server role keys (arranger/issuer, compliance, SCAS, sponsor) keep signing on-chain operations; the role guard decides who may trigger them.

## 3. Data model (Postgres)

| Table | Key fields |
| --- | --- |
| users | id, privy_did (unique), email, created_at |
| user_roles | user_id, role, granted_by, granted_at |
| wallets | user_id, address, kind (privy-embedded, phantom), verified_at |
| farmer_profiles | user_id, legal_name, bin (private), region, contact, kyc_status, kyc_decided_by, kyc_decided_at |
| investor_profiles | user_id, category (professional, retail, institutional), questionnaire (jsonb), kyc_status, risk_ack_at, decided_by, decided_at |
| applications | id, farmer_user_id, crop, grade, volume_t, tokenized_share_bps, requested_usd, proposed_coupon_bps, season, elevator, lab, status, pool_address, created_at, updated_at |
| documents | id, owner_user_id, application_id, kind (insurance, land_act, financials, encumbrance, yields, imagery, kyc, other), sha256, bucket_key, status (pending, accepted, rejected), reviewed_by, reviewed_at |
| kfd_acceptances | investor_user_id, pool_address, accepted_at, document_hash |
| audit_log | id, actor_user_id, action, target_type, target_id, payload (jsonb), tx_signature, created_at |
| notifications | id, user_id, kind, title, body, read_at, created_at |

Private identifiers (BIN, legal names, cadastral numbers) live only in Postgres and the bucket, never on-chain or in the repo.

## 4. Application status machine

`draft → submitted → documents_review → kyc → field_verification → structuring → ready → open → funded → disbursed → in_season → harvest → settlement → closed`, plus `rejected` and `withdrawn`.

From `open` on, the status is derived from the on-chain pool (Pool status, InstrumentTerms, election, attestations) and cached; the arranger never edits it by hand.

## 5. Cabinets

**Farmer (`/farmer`)**

- Onboarding wizard: company profile, issuer KYC, requirement checklist from the term sheet (insurance, land-use act and cadastral numbers, 4 financial statement forms with payables and encumbrance certificate, historical yields, field imagery) with per-document status.
- Applications: create an application (crop, grade, volume, tokenized share, requested amount, season, elevator, lab), upload fields (existing GeoJSON/KML import), submit.
- Status timeline for each application with the next action and who owns it.
- Obligations: amount due at maturity with Act/360 accrual to date, maturity date, settlement election state, buyback funding status.
- Payouts and fees history from chain transactions.

**Investor (`/investor`)**

- Onboarding: categorization questionnaire (professional, retail, institutional), mock KYC, risk acknowledgement; wallet link (Privy embedded or Phantom). Retail investors see the exempt-offer limits.
- Key features document acceptance per pool before the first subscription (recorded in `kfd_acceptances`).
- Portfolio: positions per pool with tokens, nominal, accrued coupon, maturity schedule, settlement path, grain claims; transaction history; CSV statement.

**Arranger (`/arranger`)**

- Pipeline board of applications by status with filters.
- Application detail: profile, documents with accept/reject, KYC decision for the farmer as issuer (writes the platform KYC record on-chain), field verification via the SCAS stub, term builder producing the pool and InstrumentTerms (reuses existing admin actions), publish.
- Investor KYC queue with categorization review.
- Live pools: raised, vault, maturity, election, delivery documents, settlement actions (existing admin actions).
- Roles: assign and revoke roles by email.
- Audit log of every decision and on-chain action with transaction links.
- Fee config and treasury panel (existing).

## 6. Architecture

- Next.js app router with server components for reads and server actions/route handlers for writes; role guard in a shared server helper.
- ORM: Drizzle with SQL migrations committed in `apps/web/drizzle/`; migrations run in a Railway pre-deploy step.
- Railway: add a Postgres service to project `field-to-finance`; `DATABASE_URL` as a reference variable on `web`.
- Tests: Vitest with an in-process Postgres (PGlite) for the data layer and guards; component tests for cabinets; one end-to-end devnet script that walks farmer application → arranger structuring → investor subscription.

## 7. Error handling

- Missing or invalid Privy token: redirect to sign-in. Missing role: 403 page with a way to request access.
- On-chain action failures surface the existing plain-language explanations; the audit log records the attempt and the error.
- Postgres unavailable: cabinets show an error state; public pool pages still render from chain data.

## 8. Testing

- Unit: role guard, status derivation from chain state, Act/360 accrual display, document state transitions.
- Integration: data layer on PGlite; Privy token verification with a mocked verifier.
- Component: each cabinet's primary states (empty, loading, populated, error).
- Devnet: the end-to-end walk above, with explorer links in the devlog.

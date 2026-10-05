# Complete platform: remaining cabinets and full lifecycle

Status: requested by the user on 2026-10-05 ("со всеми кабинетами, со всеми flow, чтобы была готовая платформа"). Builds on [role cabinets](2026-10-05-role-cabinets.md), which shipped farmer, investor and arranger cabinets with Privy role login and Postgres.

## 1. Goal

Every step of a pool's life, from a farmer's application to the last redemption or grain claim, is done by the right role in its own cabinet, with no script and no manual block. A judge or a pilot partner can walk the whole lifecycle in the browser on devnet.

## 2. Lifecycle and owners

| Phase | Step | Owner | Cabinet |
| --- | --- | --- | --- |
| Onboarding | Farmer profile, documents, issuer KYC request | farmer | `/farmer` |
| Onboarding | Farmer KYB/KYC decision, investor KYC and categorization | compliance | `/compliance` (new) |
| Verification | Field verification, pre-season attestation | SCAS partner | `/scas` (new) |
| Structuring | Term builder, pool and InstrumentTerms, publish | arranger | `/arranger` |
| Subscription | KFD, subscribe, refund if undersubscribed | investor | `/investor` |
| Funding | Close subscription, disburse (fees withheld) | arranger | `/arranger` |
| Season | Season attestations (sowing, vegetation, pre-harvest yield estimate) | SCAS partner | `/scas` |
| Harvest | Elevator receipt (tonnes, receipt number hash) | elevator | `/elevator` (new) |
| Harvest | Lab quality protocol against the 12-parameter spec | lab | `/elevator` (same cabinet, lab role) |
| Settlement | Election of buyback or delivery before maturity | farmer (issuer) or arranger | `/farmer`, `/arranger` |
| Settlement | Fund buyback (principal plus Act/360 coupon) | farmer (issuer) | `/farmer` |
| Settlement | Redeem for USDC, or burn for Grain Claim | investor | `/investor` |
| Closing | Sweep, close pool, final report | arranger | `/arranger` |
| Oversight | Registry of issues, holders, events, export | regulator (read-only) | `/regulator` (new) |

## 3. New roles and cabinets

Roles `compliance`, `scas`, `elevator`, `lab`, `regulator` are granted by an arranger by email (existing Roles tab). They are never self-chosen. One user may hold several service roles. Arranger keeps the ability to act for any service role (pilot fallback), and every such action is audited with the role it acted as.

**Compliance (`/compliance`)**
- Queues: farmer issuer KYC/KYB, investor KYC with categorization, retail limit monitor (exempt-offer limits: under 50 retail investors per offer; per-investor amounts), revocations.
- Decision screen with documents, questionnaire answers, decision reason; approve writes the on-chain platform KYC record with the compliance key; revoke calls `revoke_investor`.
- Moves these queues out of the arranger cabinet (arranger keeps a read view).

**SCAS partner (`/scas`)**
- Queue of fields awaiting verification with map (existing MapLibre field view), polygon hash, declared area.
- Record attestation: kind (FieldVerified, Sowing, Vegetation, YieldEstimate), evidence upload to the bucket (hash on-chain), note. Stub provider stays: the cabinet is the human surface; the partner API integration comes later behind the same action.
- Season timeline per pool: attestations by field and date.

**Elevator and lab (`/elevator`)**
- Elevator role: record ElevatorReceipt for a pool (tonnes, receipt document hash, date).
- Lab role: record LabQuality (12 parameters against the pool spec, pass/fail per parameter computed, protocol document hash).
- Both use the existing `record_delivery`/attestation instructions; no layout change.

**Regulator (`/regulator`, read-only)**
- Registry: pools with issuer, terms, status, raised, holders count; holders per pool from token accounts (wallet, balance) joined with investor category; events and audit log.
- Filters by pool, status, issuer BIN or investor IIN (BIN/IIN stored in Postgres only; a regulator sees them, nothing goes on-chain).
- CSV export of registry, holders and events.

## 4. Lifecycle gaps to close in existing cabinets

- **Farmer settlement from the web**: the issuer wallet elects buyback or delivery and funds the buyback from the farmer cabinet (Privy embedded wallet, sponsored). Obligations card shows amount due, funding deadline, lapse-to-delivery date.
- **Arranger lifecycle board**: per pool, a stepper of the phases above with the next action, its owner and a button when the arranger owns it (close subscription, disburse, sweep, close). The "Manual pilot tools" block stays for exceptions only.
- **Investor**: settlement path card per position (buyback funded / delivery), redeem and grain claim actions from the cabinet, Grain Claim certificate view (tonnes, elevator, lab result).
- **Public pool page**: season timeline (SCAS attestations), harvest and quality block once recorded, settlement status.
- **Notifications (in-app)**: bell with unread count in every cabinet; events: role granted, document accepted/rejected, KYC decided, application status changed, pool opened, subscription confirmed, disbursed, attestation recorded, election made, buyback funded, maturity approaching (7 days), grain claim recorded.
- **Deferred minors from the role-cabinets review** that remain open: any still listed in `.superpowers/sdd/2026-10-05-role-cabinets/progress.md`.

## 5. Constraints

- On-chain program: reuse existing instructions; only add instructions if a step cannot be expressed, never change existing account layouts; any program change needs tests and an in-place upgrade.
- Private identifiers (BIN, IIN, legal names, cadastral numbers, emails) only in Postgres and the bucket.
- Style lock `.tastemaker/style-lock.md` applies; one wheat primary action per screen; 390px without horizontal scroll.
- Public RPC rate limits: reads go through the existing reader cache; add retry with backoff on 429 and a short server cache for pool lists (Helius key comes later via `SOLANA_RPC_URL`).

## 6. Done when

- A devnet walk in the browser (recorded as screenshots and explorer links in the devlog) covers: farmer application, compliance KYC, SCAS verification, arranger structuring and publish, investor onboarding and subscription, disbursement, season attestations, elevator receipt, lab quality, election, buyback funding by the farmer, investor redemption; and a second pool on the delivery path ending in a Grain Claim; regulator export of both.
- Tests cover role guards for each new cabinet, every new server action's authorization, notification creation, lab pass/fail computation and the regulator export.

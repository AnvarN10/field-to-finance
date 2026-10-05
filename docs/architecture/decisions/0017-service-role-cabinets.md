---
status: Accepted
date: "2026-10-05"
---

# Service role cabinets

Accepted: user decision 2026-10-05 ("со всеми кабинетами, со всеми flow, чтобы была готовая платформа").

## Context

ADR 0016 gave the farmer, the investor and the arranger their cabinets; the arranger also stood in for compliance, the SCAS provider, the elevator, the laboratory and the regulator. A pilot partner or a judge should see each of those parties do its own step, and a regulator should be able to inspect the registry without an arranger account. The [complete platform spec](../../specs/2026-10-05-platform-complete.md) lists the steps and owners.

## Decision

- **Roles.** `compliance`, `scas`, `elevator`, `lab`, `regulator` join `farmer`, `investor`, `arranger` in `user_roles` (migration 0002 widens the role check). They are granted only by an arranger, by email, in the Roles tab; nobody chooses them. One user may hold several.
- **Cabinets.** `/compliance` (issuer and investor KYC queues, revocations, retail limit monitor), `/scas` (field verification queue, season attestations, timeline), `/elevator` (elevator receipt for the `elevator` role, 12-parameter lab protocol for the `lab` role), `/regulator` (read-only registry, holders, events, CSV export). Elevator and laboratory share one cabinet and see only their own form.
- **Arranger fallback.** An arranger may act for any service role in its cabinet. Every service action writes `audit_log.acting_role` with the role acted as, whether the actor holds the role or is an arranger.
- **Keys unchanged.** Server keys still sign: compliance (`approve_investor`, `revoke_investor`), SCAS (`record_attestation`), the platform Issuer key (`record_delivery`, which accepts SCAS or Issuer). Partners have no keys of their own in the pilot; the role guard decides who may trigger each signature.
- **No program change.** The pre-harvest yield estimate is a `Harvest` attestation whose evidence JSON carries `yieldEstimateTPerHa`; no attestation kind is added.
- **Farmer settlement.** The farmer's Privy wallet signs `elect_settlement` and `fund_redemption` as sponsored user transactions (`/api/tx/elect-settlement`, `/api/tx/fund-redemption`), built and co-signed only for the pool's issuer of record.
- **Regulator data.** The regulator sees issuer legal names, BIN and investor IIN (Postgres only), never emails, investor names, KYC answers or review notes; events keep a whitelist of payload keys.

## Consequences

- Each lifecycle step has an owner and a screen; the arranger's lifecycle board shows who acts next.
- More roles to grant and revoke; a mis-granted service role can trigger the server key it maps to (but nothing else: each workflow checks its own role).
- Partners acting through server keys means the on-chain signer is the platform's key, not the partner's; real partner keys need `Config` rotation (SCAS) or a program change (elevator, laboratory).

## Alternatives considered

- Keep everything in the arranger cabinet: no separation of duties to show a pilot partner or a regulator.
- One "service" role with sub-permissions: harder to audit and to explain than one role per party.
- Partner-held keys now: needs program changes and key distribution before the deadline.

## Related code

- `apps/web/src/lib/workflow/guards.ts` (`assertServiceRole`), `apps/web/src/lib/server/auth.ts` (`requireServiceAction`, `requireAnyRole`)
- `apps/web/src/lib/workflow/{compliance,scas,delivery,regulator,notifications,tx-history}.ts`
- `apps/web/src/app/{compliance,scas,elevator,regulator}/`, `apps/web/drizzle/0002_service_roles.sql`

## Related docs

- [Web app](../../systems/web.md), [Data](../../systems/data.md), [ADR 0016](0016-privy-role-login-and-postgres-for-off-chain-workflow.md), [ADR 0012](0012-scas-external-provider-stub.md), [ADR 0014](0014-farmer-issuer-of-record-and-hybrid-instrument-terms.md)
- [Compliance review](../../flows/compliance-review.md), [Season and harvest](../../flows/season-and-harvest.md), [Settlement](../../flows/settlement.md)

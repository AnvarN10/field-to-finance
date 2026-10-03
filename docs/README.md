# Field-to-Finance documentation

Durable, repo-local documentation for humans and AI agents. Source code is the implementation source of truth; these docs explain systems, flows, constraints and decisions at a useful level of abstraction.

## Start here

- [Business context](business/CONTEXT.md) — the problem, roles and the deal lifecycle in plain words.
- [Glossary](glossary.md) — domain terms with precise meanings.
- [Style guide](STYLE.md) — how to write docs in this repo.

## Systems

System docs live in [systems/](systems/). Planned systems, created once code exists:

- [program.md](systems/program.md) — the Solana program: pools, attestations, subscriptions, settlement.
- `scas.md` — field verification worker and satellite data pipeline.
- `kyc.md` — investor and farmer onboarding, account thaw.
- `web.md` — farmer, investor and admin web app.

## Flows

Flow docs live in [flows/](flows/).

- [pool-lifecycle.md](flows/pool-lifecycle.md) — from field registration to redemption.

Planned flows:

- `field-verification.md` — from field registration to the first signed attestation.
- `pool-issuance.md` — from verified projects to a published pool.
- `primary-subscription.md` — investor KYC, thaw, USDC in, tokens out.
- `season-monitoring.md` — attestations during the season.
- `settlement.md` — harvest, shortfall handling and investor payout.

## Architecture

- [Architecture overview](architecture/README.md)
- [Decision records](architecture/decisions/README.md)

## Specs

- [MVP design, 2026-10-03](specs/2026-10-03-mvp-design.md)

## Plans

- [Program, 2026-10-03](plans/2026-10-03-program.md)

## Other

- [Devlog](devlog/) — one entry per working day of the hackathon.
- [Templates](templates/) — [system](templates/system.md), [flow](templates/flow.md), [ADR](templates/adr.md).

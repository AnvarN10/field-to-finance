# Field-to-Finance documentation

Durable, repo-local documentation for humans and AI agents. Source code is the implementation source of truth; these docs explain systems, flows, constraints and decisions at a useful level of abstraction.

## Start here

- [Business context](business/CONTEXT.md) — the problem, roles and the deal lifecycle in plain words.
- [Glossary](glossary.md) — domain terms with precise meanings.
- [Style guide](STYLE.md) — how to write docs in this repo.

## Systems

System docs live in [systems/](systems/). Planned systems, created once code exists:

- [program.md](systems/program.md) — the Solana program: pools, attestations, subscriptions, settlement.
- [web.md](systems/web.md) — web app: sign-up doors, investor app, issuer workspace, permission-based console, server-built transactions, SCAS stub.
- [data.md](systems/data.md) — Postgres: accounts, roles, applications, documents, KFD, audit log; migrations and privacy.
- SCAS — external provider; MVP stub inside the web app ([ADR 0012](architecture/decisions/0012-scas-external-provider-stub.md)).

## Flows

Flow docs live in [flows/](flows/).

- [pool-lifecycle.md](flows/pool-lifecycle.md) — from field registration to redemption.
- [primary-subscription.md](flows/primary-subscription.md) — platform-level KYC, subscribe, USDC in, tokens out.
- [field-verification.md](flows/field-verification.md) — from polygon upload to the first stub attestation.
- [farmer-onboarding.md](flows/farmer-onboarding.md) — farmer sign-up, profile, issuer KYC, application, documents, fields.
- [investor-onboarding.md](flows/investor-onboarding.md) — category, KYC by an arranger, risk acknowledgement, wallet link, key features document.
- [issuance-pipeline.md](flows/issuance-pipeline.md) — from a submitted application to a published pool, then statuses from the chain.
- [compliance-review.md](flows/compliance-review.md) — issuer and investor KYC, revocations, retail limits in the console.
- [season-and-harvest.md](flows/season-and-harvest.md) — SCAS verification and season attestations, elevator receipt, lab protocol.
- [settlement.md](flows/settlement.md) — election, buyback funding, redemption or Grain Claim, closing and the regulator's export.

## Architecture

- [Architecture overview](architecture/README.md)
- [Decision records](architecture/decisions/README.md)

## Specs

- [MVP design, 2026-10-03](specs/2026-10-03-mvp-design.md)
- [Role cabinets, 2026-10-05](specs/2026-10-05-role-cabinets.md)
- [Complete platform, 2026-10-05](specs/2026-10-05-platform-complete.md)
- [Cabinets redesign: separate doors and a permission-based console, 2026-10-07](specs/2026-10-07-cabinets-redesign.md)

## Plans

- [Program, 2026-10-03](plans/2026-10-03-program.md)
- [Web app, 2026-10-03](plans/2026-10-03-web.md)
- [Role cabinets, 2026-10-05](plans/2026-10-05-role-cabinets.md)
- [Cabinets redesign, 2026-10-07](plans/2026-10-07-cabinets-redesign.md)
- [Complete platform, 2026-10-05](plans/2026-10-05-platform-complete.md)

## Other

- [Devlog](devlog/) — one entry per working day of the hackathon.
- [Templates](templates/) — [system](templates/system.md), [flow](templates/flow.md), [ADR](templates/adr.md).

## Research

- [Cabinets UX benchmarks (RU), 2026-10-07](research/cabinets-ux/report-ru.md) — RWA and crowdlending platforms: doors, onboarding, portfolios, back-office RBAC; [PDF](research/cabinets-ux/report-ru.pdf).

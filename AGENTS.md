# AGENTS.md

Field-to-Finance (F2F) lets a farmer raise money today against part of next season's harvest. Fields are verified with satellite data, an Issuer packages verified farm projects into a pooled token on Solana, investors buy it with USDC, and the pool is settled after harvest.

Built for the Solana Colosseum "Crypto World’s Fair" hackathon. Contest period: 2026-09-14 06:00 PT to 2026-10-12 23:59 PT. Submission deadline: 2026-10-12 23:59 PT.

`AGENTS.md` tells agents where to look and how to work; `docs/` explains how the application works.

## Docs map

- [docs/README.md](docs/README.md) — entry point and index of all docs.
- [docs/glossary.md](docs/glossary.md) — domain terms. Read it before naming anything.
- [docs/systems/](docs/systems/) — how each system works.
- [docs/flows/](docs/flows/) — behavior that crosses systems.
- [docs/architecture/](docs/architecture/) — cross-system structure and [decisions](docs/architecture/decisions/README.md).
- [docs/business/CONTEXT.md](docs/business/CONTEXT.md) — business domain summary; sources in `docs/business/raw/`.
- [docs/specs/](docs/specs/) — design specs. Implementation plans go to `docs/plans/`.
- [docs/devlog/](docs/devlog/) — dated log of hackathon work.
- [docs/templates/](docs/templates/) — templates for system, flow and ADR docs.

## How to work

1. Read the docs related to the area you change before touching code.
2. Treat only ADRs with status `Accepted` as current guidance. Architectural decisions are human-owned: draft ADRs as `Proposed`.
3. When behavior, responsibilities, flows, invariants, interfaces or glossary terms change, update the affected docs in the same commit.
4. Docs and code must agree. If they disagree, fix one or call out the mismatch explicitly.
5. Do not put detailed system behavior in this file.

## Hackathon rules for this repo

- Only work done inside the hackathon window is judged. Commit small and often, push daily, never squash or rewrite pushed history, never backdate commits.
- Add a short entry to `docs/devlog/` for each working day.
- The repo is private. Before submitting, grant read access to `hackathon@colosseum.com`.
- All submission material is in English: pitch video 2–3 min, demo video up to 3 min, logo, go-to-market plan.
- Field-to-Finance is independent from the CommodityChain Exchange (CCX) codebase. Do not copy CCX code or commit CCX documents here.
- Never commit secrets. Secrets live in Infisical (organization `personal`).

## Infrastructure

- Errors: GlitchTip, organization `personal`.
- Analytics and feature flags: shared PostHog EU project.

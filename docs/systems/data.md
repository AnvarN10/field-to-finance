# Data (Postgres)

## Purpose

Postgres holds the off-chain workflow of the role cabinets ([ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md)): accounts and roles, wallets, farmer and investor profiles, applications, document metadata, key features document acceptances, the audit log and in-app notifications. The chain keeps money, rights, hashes and attestations; the bucket keeps files.

## Questions this doc answers

- Which tables exist and who writes them?
- How are migrations made and applied?
- Where do private identifiers live, and where must they never go?
- What happens when Postgres is down?

## Scope

Schema (`apps/web/src/lib/db/schema.ts`), migrations (`apps/web/drizzle/`), the migration runner, the Railway service and its connection settings, the privacy rules for workflow data.

## Non-scope

- Business rules of the workflow: see [web.md](web.md) and the flows.
- Program accounts: see [program.md](program.md).

## Key concepts

Application, Key Features Document (KFD), Issuer of Record, KYC. See the [glossary](../glossary.md).

## How the system works

- **Driver and ORM.** Drizzle ORM 0.45 over `postgres` (postgres-js) in the app and scripts (`createPgDb`, pool of 5, prepared statements off for the Railway proxy); PGlite (in-process Postgres) in tests with the same migrations (`test/helpers/db.ts`). Code takes the `Db` type, so the workflow layer runs unchanged on both.
- **Migrations.** Edit `schema.ts`, then `pnpm --filter @f2f/web run db:generate --name <change>`; commit the SQL and `drizzle/meta`. `scripts/migrate.ts` (bundled by `build:migrate` into `dist/migrate.mjs` with esbuild, copied into the image with `drizzle/`) applies pending migrations in one transaction and records them in `drizzle.__drizzle_migrations`. Railway runs it as the pre-deploy command of `web` (`node apps/web/dist/migrate.mjs`, set on the service instance through the Railway API, not in a file): a failed migration stops the deploy and the previous deployment keeps serving. Locally: `scripts/inf.sh node apps/web/dist/migrate.mjs` after `build:migrate`.
- **Applying migrations by hand.** When the pre-deploy step was skipped (a new service, a reset instance, a deploy from another tool), run from the repository root against the production database:

  ```bash
  pnpm --filter @f2f/web run build:migrate          # bundles scripts/migrate.ts into apps/web/dist/migrate.mjs
  scripts/inf.sh node apps/web/dist/migrate.mjs     # DATABASE_URL from Infisical dev (the Railway TCP proxy)
  ```

  It prints "Migrations applied" (idempotent: applied migrations are skipped) or "Migration failed: <reason>" with exit code 1. On Railway itself: `railway ssh --service web -- node apps/web/dist/migrate.mjs`.
- **Fail closed on an old schema.** `getDb()` compares the newest migration recorded in `drizzle.__drizzle_migrations` with the newest one the build ships (`drizzle/meta/_journal.json`). When the database is behind, every Postgres-backed page and action shows its error state and the server log says `The database schema is behind this build: it expects <tag>. Run the migrations: ...`. The check reruns on the next request, so the app recovers by itself after the migrations run.
- **Writers.** Only server code writes: workflow modules in `src/lib/workflow/*` (called by server actions, `POST /api/session`, the devnet script) and `src/lib/server/tx-history.ts` (sponsored user transactions as `tx.<action>` audit rows).

## Data and state

| Table | Holds | Written by |
| --- | --- | --- |
| `users` | id, Privy DID (unique, null until first sign-in when granted by email), email (unique, lower case) | sign-in, role grant by email |
| `user_roles` | (user, role) with who granted it; role in `farmer`, `investor`, `arranger`, `compliance`, `scas`, `elevator`, `lab`, `regulator` (service roles only by an arranger's grant, [ADR 0017](../architecture/decisions/0017-service-role-cabinets.md)). Partial unique index `user_roles_one_self_cabinet`: at most one self-chosen (`granted_by = user_id`) farmer or investor role per account | role choice, `ARRANGER_EMAILS` bootstrap (at every sign-in that lacks it), arranger grant and revoke |
| `wallets` | address (primary key: one account per wallet), owner, kind (`privy-embedded`, `phantom`), verified time | sign-in (Privy embedded wallet from Privy), signed-message link (Phantom) |
| `farmer_profiles` | legal name, BIN, region, contact, issuer KYC status, note, `kyc_wallet` (the issuer wallet KYC approved on-chain: only it may register the project and be the issuer of record), decider and time | farmer onboarding, arranger KYC decision |
| `investor_profiles` | category, questionnaire answers and mock KYC (name, country, optional IIN) as JSON, KYC status, risk acknowledgement time, decider | investor onboarding, arranger KYC decision |
| `applications` | crop, grade, volume, tokenized share, requested USD, proposed coupon, season, elevator, laboratory, status, status note, on-chain project, field set hash, pool id and address | farmer, arranger steps, chain status refresh |
| `documents` | owner, application (null for issuer KYC and service uploads), kind, SHA-256, bucket key, type, size, review status and note, reviewer, `replaced_at` | farmer uploads, arranger review, service uploads (SCAS evidence, elevator receipts, lab protocols as kind `other`, registered to the uploader) |
| `kfd_acceptances` | (investor, pool address), KFD SHA-256, time | investor |
| `audit_log` | actor (null for system), `acting_role` (the service role acted as, also when an arranger acts for it), action, target, payload JSON, first transaction signature (all of them in the payload when several), error when the attempt failed | every decision and on-chain action |
| `notifications` | user, kind, title, body, `link` (in-app path), `dedupe_key` (unique when set: at most one row per key, e.g. maturity reminders), read time | workflow decisions, status changes, sponsored transactions, maturity reminders |
| `platform_settings` | key, value. `environment = production` marks the production database: trigger `users_no_dev_identity_in_production` then refuses `did:dev:*` identities from any process | set once by hand on the production database |

Check constraints pin every enumerated column (roles, statuses, kinds). A replaced document keeps its row with `replaced_at` set, so the review history survives re-uploads.

## Interfaces and entry points

- `getDb()` in `src/lib/server/db.ts` (server only, memoized, rejects when `DATABASE_URL` is unset).
- `createPgDb(url)` and `migrateUrl(url, folder)` in `src/lib/db/` (scripts).
- Railway: service `Postgres` (`55abe5e5-be92-4027-8111-f46803f0df92`) in project `field-to-finance`, environment `production`. `web` reads `DATABASE_URL=${{Postgres.DATABASE_URL}}` (private network). A TCP proxy exposes it for local work; its URL is `DATABASE_URL` in Infisical `dev`.

## Dependencies

Railway Postgres (template PostgreSQL with a volume), `drizzle-orm` 0.45.3, `postgres` 3.4.9, `drizzle-kit` 0.31.11 (dev), `@electric-sql/pglite` 0.5.8 (tests), `esbuild` 0.28.2 (bundles the runner).

## Downstream effects

Renaming a column or a status breaks the workflow modules, the check constraints and the derived-status cache; status names are also shown in the UI through `STATUS_INFO`. Never edit a committed migration: add a new one.

## Invariants and assumptions

- One wallet belongs to at most one account (primary key), so KYC and KFD gates cannot be borrowed across accounts.
- A self-service account has one cabinet; the unique index enforces it under concurrent requests. Removing an arranger role locks every arranger row in one transaction, so the platform always keeps one arranger.
- The issuer of record of a pool is the farmer's KYC-approved wallet (`kyc_wallet`); structuring refuses any other producer.
- No dev or demo identity lives in the production database: the devnet walk keeps its workflow data in an in-process database (or `DEMO_DATABASE_URL`), and the trigger refuses `did:dev:*` once `platform_settings.environment = production`.
- Statuses from `open` on are only written by the chain refresh (`refreshChainStatuses`), never by hand.
- Every arranger decision and on-chain action writes an audit row, including failed attempts.
- Migrations are additive and run before the new code serves traffic.

## Error handling

- Schema behind the build: same error states as Postgres down, with the migrate command in the server log.
- Postgres down: cabinets render an error state ("Your cabinet is unavailable"), `POST /api/session` answers 503, the subscribe gate answers 503 (fails closed). Pool pages, field pages, refunds, redemptions and grain claims do not touch Postgres.
- Driver errors are never shown to users; they go to GlitchTip without request bodies.

## Security and privacy notes

- **Private identifiers live only here and in the bucket**: BIN, legal names, contacts, investor names and countries, emails, cadastral numbers (bucket field sets). They never go on-chain, into the repository, logs, PostHog or GlitchTip. Demo and seed data use obviously fake values (`Demo Farm LLP`, BIN `000000000000`, `demo+...@example.com`).
- Only arrangers and compliance read other users' profiles; the regulator sees issuer legal names, BIN and investor IIN with category, never emails, investor names, KYC answers or review notes (events export only whitelisted payload keys and blanks user targets). The SCAS partner, elevator and laboratory see no company identity. Documents are served by hash to arrangers, to compliance for issuer KYC files, and to the uploader only (`/api/documents/[hash]`).
- The audit log stores rejection notes and wallet addresses; it is shown in full only in the arranger cabinet.
- The database URL is a secret: Railway reference variable for `web`, Infisical for local work, never printed.
- Retention: no automatic deletion in the pilot. Removing a user cascades to roles, wallets, profiles, KFD acceptances and notifications; audit rows keep the action with the actor set to null.

## Observability and debugging

- `scripts/inf.sh node apps/web/dist/migrate.mjs` prints "Migrations applied" or the failure.
- Railway deploy logs show the pre-deploy step before the container starts.
- The arranger's audit log (`/arranger/audit`) is the first place to look for what happened to an application.

## Testing notes

`pnpm nx run web:test` runs the data layer, guards and workflows on PGlite with the committed migrations (`test/db-schema.test.ts`, `test/workflow-*.test.ts`, `test/auth-session.test.ts`, `test/service-roles.test.ts`, `test/notifications.test.ts`). Migration `0002_service_roles` widens the role check and adds `audit_log.acting_role`, `notifications.link` and `notifications.dedupe_key` with a partial unique index: additive, no rewrite of existing rows. A schema change without a generated migration fails these tests.

## Common pitfalls

- `drizzle-kit generate` must run from `apps/web` (it reads `drizzle.config.ts`).
- Railway's Postgres template did not create `DATABASE_PUBLIC_URL`; the TCP proxy was added through the API and the public URL composed from the proxy host and port.
- The public devnet RPC rate-limits program-account scans, so status refresh on page loads is throttled to once every 30 seconds per process; arranger actions refresh at once.

## Source map

- [src/lib/db/schema.ts](../../apps/web/src/lib/db/schema.ts) — tables
- [src/lib/db/client.ts](../../apps/web/src/lib/db/client.ts), [src/lib/db/migrate.ts](../../apps/web/src/lib/db/migrate.ts), [scripts/migrate.ts](../../apps/web/scripts/migrate.ts)
- [drizzle/](../../apps/web/drizzle/) — committed migrations
- [src/lib/workflow/](../../apps/web/src/lib/workflow/) — every writer
- [test/helpers/db.ts](../../apps/web/test/helpers/db.ts) — PGlite harness

## Related docs

- [Web app](web.md), [ADR 0016](../architecture/decisions/0016-privy-role-login-and-postgres-for-off-chain-workflow.md), [Farmer onboarding](../flows/farmer-onboarding.md), [Investor onboarding](../flows/investor-onboarding.md), [Issuance pipeline](../flows/issuance-pipeline.md)

# Role Cabinets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the password-protected demo console and the thin `/farmer` and `/portfolio` pages with three role cabinets (farmer issuer, investor, arranger) behind Privy email sign-in, with off-chain workflow data in Postgres on Railway.

**Architecture:** Privy signs users in on the client; the browser posts the Privy access token to `POST /api/session`, which verifies it with `@privy-io/server-auth`, upserts the user in Postgres and stores the token in an httpOnly cookie. Every protected page, server action and route handler re-verifies that cookie token and loads roles from Postgres (`src/lib/server/auth.ts`). Business rules live in framework-free workflow modules (`src/lib/workflow/*`) that take a Drizzle database and narrow chain ports, so the same code runs in server actions, in Vitest on PGlite and in the devnet end-to-end script. From `open` onwards an application's status is derived from the on-chain Pool and cached in the row.

**Tech Stack:** existing stack (Next.js 16.3.8, React 19.3.0, Tailwind 4.3.3, zod 4.6.5, vitest 5.0.3) plus `@privy-io/server-auth` 1.32.5, `drizzle-orm` 0.45.3, `drizzle-kit` 0.31.11, `postgres` 3.4.9, `@electric-sql/pglite` 0.5.8, `esbuild` (pinned, bundles the migration runner).

**Spec:** [docs/specs/2026-10-05-role-cabinets.md](../specs/2026-10-05-role-cabinets.md). Read with [docs/systems/web.md](../systems/web.md), ADRs 0011 to 0015.

## Global Constraints

- Roles are exactly `farmer`, `investor`, `arranger`. Cabinets: `/farmer`, `/investor` (replaces `/portfolio`), `/arranger` (replaces `/admin`).
- Sign-in: Privy email for all roles. The server verifies the Privy access token with `PRIVY_APP_SECRET` on every protected request and loads roles from Postgres.
- Bootstrap: emails in `ARRANGER_EMAILS` (comma-separated, case-insensitive) get `arranger` on first sign-in. The value lives in Infisical and Railway, never in the repo.
- A new user chooses "I am a farmer" or "I am an investor"; the role is granted immediately; onboarding gates what they can do.
- `ADMIN_PASSWORD` login is removed. Basic auth (ADR 0015, `src/proxy.ts`) stays in front of everything; `/api/health` stays the only public path.
- Server role keys (Issuer, compliance, SCAS, sponsor) keep signing on-chain operations; the role guard decides who may trigger them. Every arranger decision and every on-chain action writes `audit_log` (attempt and outcome, with signatures).
- Private identifiers (BIN, legal names, cadastral numbers, emails) live only in Postgres and the bucket: never on-chain, never in the repo, never in logs, analytics or GlitchTip. Seed and demo data use obviously fake values (`Demo Farm LLP`, BIN `000000000000`, `demo+farmer@example.com`).
- On-chain program unchanged.
- Status machine: `draft → submitted → documents_review → kyc → field_verification → structuring → ready → open → funded → disbursed → in_season → harvest → settlement → closed`, plus `rejected` and `withdrawn`. From `open` on the status is derived from chain state and cached; the arranger never edits it by hand.
- Existing devnet pools 1, 2, 5, 6, 7, 8 keep rendering on `/pools` and in the arranger's live pools. Existing approved investor wallets stay approved; wallet `Gwgdy3wH4pzmjdRiD6DmHDCNyxCr1pmthCtmt7AypPYZ` is never revoked.
- Modules under `apps/web/src/lib/` except `src/lib/server/` use relative imports only (the devnet scripts import them through `tsx`). `src/lib/server/*` starts with `import "server-only"`.
- `.tastemaker/style-lock.md` (dark "Night field") is law: tokens from `globals.css`, no hex in components, no `dark:` variants, wheat only for the primary action and key numbers, one sans family, 24px heading ceiling in app pages, no nested cards, tabular numbers, mono only for addresses, hashes and signatures.
- UI copy in English, sentence case, no em dashes. Amounts from integer USDC base units, shown in USD.
- Package versions are pinned exactly (no `^`).
- Commits end with a blank line and `Claude-Session: https://claude.ai/code/session_01ME22MMec3RnxBQUt7ynVd7`. Never force-push. Secrets only via `scripts/inf.sh`, Infisical or Railway; never print them.

## Review Focus

1. **Expired or forged session cookie on a server action** (a stale tab posting after the Privy token expired, or a cookie copied from another app): the action must refuse with "Sign in again", never run with a cached identity. Test in Task 2 (`requireActionRole` with an expired and a foreign token).
2. **Role removed while signed in** (arranger revokes a user's role, the user keeps the tab open): the next request must see the new roles because roles are loaded from Postgres per request, not stored in the cookie. Test in Task 2.
3. **An arranger revoking their own arranger role, or the last arranger**: refused, so the platform is never left without an operator. Test in Task 4.
4. **A wallet linked to two accounts** (the same Phantom signs for an investor and a farmer account): the second link is refused, so KYC and KFD gates cannot be borrowed. Test in Task 4.
5. **Subscribe from a wallet that is on-chain approved but has no KFD acceptance for that pool** (legacy approved wallets): the transaction is refused before the wallet opens, with a link to the KFD page, while pool pages still render when Postgres is down. Test in Task 5.

---

## File map

| File | Responsibility |
| --- | --- |
| `apps/web/drizzle.config.ts`, `apps/web/drizzle/*.sql` | Drizzle Kit config and committed SQL migrations |
| `apps/web/src/lib/db/schema.ts` | Tables and row types |
| `apps/web/src/lib/db/client.ts` | `Db` type, `createPgDb(url)` |
| `apps/web/src/lib/db/migrate.ts` + `apps/web/scripts/migrate.ts` | migration runner (bundled to `dist/migrate.mjs` for Railway pre-deploy) |
| `apps/web/test/helpers/db.ts` | PGlite database with migrations applied |
| `apps/web/src/lib/application-status.ts` | statuses, labels, owner and next action, transitions, chain derivation |
| `apps/web/src/lib/accrual.ts` | Act/360 accrual to date, obligations |
| `apps/web/src/lib/statement.ts` | CSV statement |
| `apps/web/src/lib/wallet-link.ts` | wallet-link message and ed25519 check |
| `apps/web/src/lib/auth/session.ts` | `PrivyPort`, `signInWithToken`, `resolveSession`, `checkRole` |
| `apps/web/src/lib/workflow/*.ts` | users and roles, audit, notifications, farmer, investor, arranger workflows |
| `apps/web/src/lib/server/db.ts`, `server/privy.ts`, `server/auth.ts`, `server/chain-port.ts` | Next-bound singletons, guards, chain port implementation |
| `apps/web/src/app/api/session/route.ts` | session create and delete |
| `apps/web/src/app/sign-in/*` | sign-in and role choice |
| `apps/web/src/app/farmer/*`, `investor/*`, `arranger/*` | cabinets and their server actions |
| `apps/web/src/components/auth/*`, `components/cabinet/*` | Privy provider, session sync, cabinet shell, timeline, checklist |
| `scripts/demo-cabinets.ts`, `apps/web/src/lib/demo/cabinet-flow.ts` | devnet end-to-end walk |

---

### Task 1: Data foundation (Drizzle schema, migrations, PGlite harness)

**Files:**
- Modify: `apps/web/package.json` (deps, scripts `db:generate`, `build:migrate`)
- Create: `apps/web/drizzle.config.ts`, `apps/web/src/lib/db/schema.ts`, `apps/web/src/lib/db/client.ts`, `apps/web/src/lib/db/migrate.ts`, `apps/web/scripts/migrate.ts`, `apps/web/drizzle/0000_*.sql` (generated)
- Test: `apps/web/test/helpers/db.ts`, `apps/web/test/db-schema.test.ts`

**Interfaces:**
- Produces: `Db` (Drizzle Postgres database type shared by postgres-js and PGlite), tables `users, userRoles, wallets, farmerProfiles, investorProfiles, applications, documents, kfdAcceptances, auditLog, notifications`, types `Role`, `KycStatus`, `DocumentKind`, `DocumentStatus`, `testDb(): Promise<Db>`.

- [ ] **Step 1: Install pinned deps**

```bash
cd apps/web
pnpm add -E @privy-io/server-auth@1.32.5 drizzle-orm@0.45.3 postgres@3.4.9
pnpm add -E -D drizzle-kit@0.31.11 @electric-sql/pglite@0.5.8 esbuild@<npm view esbuild version>
```

- [ ] **Step 2: Write the failing test** `test/db-schema.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { applications, users, userRoles } from "../src/lib/db/schema";
import { testDb } from "./helpers/db";

describe("schema", () => {
  it("applies migrations and enforces unique emails and wallets", async () => {
    const db = await testDb();
    const [u] = await db.insert(users).values({ email: "demo+farmer@example.com", privyDid: "did:privy:1" }).returning();
    await db.insert(userRoles).values({ userId: u!.id, role: "farmer" });
    await expect(db.insert(users).values({ email: "demo+farmer@example.com" })).rejects.toThrow();
    const [a] = await db.insert(applications).values({ farmerUserId: u!.id, crop: "wheat", grade: "3", volumeT: 1000, tokenizedShareBps: 3000, requestedUsd: 100000, proposedCouponBps: 1200, season: 2027, elevator: "Demo elevator", lab: "Demo lab" }).returning();
    expect(a!.status).toBe("draft");
    expect((await db.select().from(userRoles).where(eq(userRoles.userId, u!.id))).map((r) => r.role)).toEqual(["farmer"]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails** (`pnpm exec vitest run test/db-schema.test.ts`, expected: cannot resolve `../src/lib/db/schema`).

- [ ] **Step 4: Implement** `src/lib/db/schema.ts`

```ts
import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ApplicationStatus } from "../application-status";

export const ROLES = ["farmer", "investor", "arranger"] as const;
export type Role = (typeof ROLES)[number];
export const KYC_STATUSES = ["not_started", "pending", "approved", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];
export const DOCUMENT_KINDS = ["insurance", "land_act", "financials", "encumbrance", "yields", "imagery", "kyc", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_STATUSES = ["pending", "accepted", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export const INVESTOR_CATEGORIES = ["professional", "retail", "institutional"] as const;
export type InvestorCategory = (typeof INVESTOR_CATEGORIES)[number];
export const WALLET_KINDS = ["privy-embedded", "phantom"] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const inList = (col: string, values: readonly string[]) => sql.raw(`${col} in (${values.map((v) => `'${v}'`).join(", ")})`);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  privyDid: text("privy_did").unique(),
  email: text("email").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    grantedBy: uuid("granted_by").references(() => users.id),
    grantedAt: ts("granted_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] }), check("user_roles_role", inList("role", ROLES))],
);

export const wallets = pgTable(
  "wallets",
  {
    address: text("address").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<WalletKind>().notNull(),
    verifiedAt: ts("verified_at").notNull().defaultNow(),
  },
  (t) => [index("wallets_user").on(t.userId), check("wallets_kind", inList("kind", WALLET_KINDS))],
);

export const farmerProfiles = pgTable("farmer_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  legalName: text("legal_name"),
  bin: text("bin"),
  region: text("region"),
  contact: text("contact"),
  kycStatus: text("kyc_status").$type<KycStatus>().notNull().default("not_started"),
  kycNote: text("kyc_note"),
  kycDecidedBy: uuid("kyc_decided_by").references(() => users.id),
  kycDecidedAt: ts("kyc_decided_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const investorProfiles = pgTable("investor_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").$type<InvestorCategory>(),
  questionnaire: jsonb("questionnaire").$type<Record<string, unknown>>().notNull().default({}),
  kycStatus: text("kyc_status").$type<KycStatus>().notNull().default("not_started"),
  kycNote: text("kyc_note"),
  riskAckAt: ts("risk_ack_at"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: ts("decided_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    farmerUserId: uuid("farmer_user_id").notNull().references(() => users.id),
    crop: text("crop").notNull(),
    grade: text("grade").notNull(),
    volumeT: integer("volume_t").notNull(),
    tokenizedShareBps: integer("tokenized_share_bps").notNull(),
    requestedUsd: bigint("requested_usd", { mode: "number" }).notNull(),
    proposedCouponBps: integer("proposed_coupon_bps").notNull(),
    season: integer("season").notNull(),
    elevator: text("elevator").notNull(),
    lab: text("lab").notNull(),
    status: text("status").$type<ApplicationStatus>().notNull().default("draft"),
    statusNote: text("status_note"),
    projectAddress: text("project_address"),
    fieldSetHash: text("field_set_hash"),
    poolId: text("pool_id"),
    poolAddress: text("pool_address"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("applications_farmer").on(t.farmerUserId), index("applications_status").on(t.status)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
    applicationId: uuid("application_id").references(() => applications.id),
    kind: text("kind").$type<DocumentKind>().notNull(),
    sha256: text("sha256").notNull(),
    bucketKey: text("bucket_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    status: text("status").$type<DocumentStatus>().notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: ts("reviewed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("documents_application").on(t.applicationId), index("documents_owner").on(t.ownerUserId), index("documents_sha").on(t.sha256)],
);

export const kfdAcceptances = pgTable(
  "kfd_acceptances",
  {
    investorUserId: uuid("investor_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    poolAddress: text("pool_address").notNull(),
    documentHash: text("document_hash").notNull(),
    acceptedAt: ts("accepted_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.investorUserId, t.poolAddress] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    txSignature: text("tx_signature"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_created").on(t.createdAt), index("audit_target").on(t.targetType, t.targetId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user").on(t.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type ApplicationRow = typeof applications.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type FarmerProfileRow = typeof farmerProfiles.$inferSelect;
export type InvestorProfileRow = typeof investorProfiles.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
```

`src/lib/db/client.ts`

```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Any Drizzle Postgres database over this schema: postgres-js in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

export async function createPgDb(url: string): Promise<Db> {
  const [{ drizzle }, { default: postgres }] = await Promise.all([import("drizzle-orm/postgres-js"), import("postgres")]);
  const client = postgres(url, { max: 5, idle_timeout: 30, prepare: false });
  return drizzle(client, { schema }) as unknown as Db;
}
```

`src/lib/db/migrate.ts` (runs on postgres-js; the test helper uses `drizzle-orm/pglite/migrator` with the same folder)

```ts
export async function migrateUrl(url: string, migrationsFolder: string): Promise<void> {
  const [{ drizzle }, { migrate }, { default: postgres }] = await Promise.all([
    import("drizzle-orm/postgres-js"), import("drizzle-orm/postgres-js/migrator"), import("postgres"),
  ]);
  const client = postgres(url, { max: 1 });
  try { await migrate(drizzle(client), { migrationsFolder }); } finally { await client.end(); }
}
```

`apps/web/scripts/migrate.ts`: reads `DATABASE_URL` (exit 1 with "DATABASE_URL is not set" when blank), resolves `MIGRATIONS_DIR` env or `./drizzle` next to the bundle, prints only "Migrations applied".

`test/helpers/db.ts`

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { schema, type Db } from "../../src/lib/db/client";

export async function testDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  return db as unknown as Db;
}
```

`drizzle.config.ts`: `{ dialect: "postgresql", schema: "./src/lib/db/schema.ts", out: "./drizzle" }`. Generate: `pnpm exec drizzle-kit generate --name init`.

- [ ] **Step 5: Run the test, verify it passes; run the whole suite (405 + new).**
- [ ] **Step 6: Commit** `feat(web): Postgres schema, migrations and PGlite test harness`.

### Task 2: Privy session and role guard

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/server/privy.ts`, `src/lib/server/db.ts`, `src/lib/server/auth.ts`, `src/app/api/session/route.ts`
- Modify: `src/lib/env.ts` (add `DATABASE_URL`, `PRIVY_APP_SECRET`, `ARRANGER_EMAILS`; remove `ADMIN_PASSWORD`), delete `src/lib/admin-auth.ts` and `test/admin-auth.test.ts` (Task 5 removes its last users)
- Test: `test/auth-session.test.ts`, `test/routes/session.test.ts`, `test/env.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_COOKIE = "f2f_session"`
  - `interface PrivyPort { verify(token: string): Promise<{ did: string; expiresAt: number }>; profile(did: string): Promise<{ email: string | null; solanaWallets: string[] }> }`
  - `interface SessionUser { id: string; email: string; roles: Role[] }`
  - `signInWithToken(db: Db, privy: PrivyPort, token: string, arrangerEmails: string[]): Promise<{ user: SessionUser; expiresAt: number }>`
  - `resolveSession(db: Db, privy: PrivyPort, token: string | undefined): Promise<SessionUser | null>`
  - `checkRole(user: SessionUser | null, role: Role): "ok" | "signin" | "forbidden"`
  - `parseArrangerEmails(value: string | undefined): string[]`
  - server: `currentUser(): Promise<SessionUser | null>`, `requireRole(role, nextPath): Promise<SessionUser | { forbidden: true; user: SessionUser }>` (redirects to `/sign-in?next=` when signed out), `requireActionRole(role): Promise<SessionUser>` (throws `RequestError` 401 "Your session expired. Sign in again." / 403 "Your account does not have the <role> role.").

- [ ] **Step 1: Write the failing tests** (`test/auth-session.test.ts`)

```ts
const privy = (map: Record<string, { did: string; email: string | null; expiresAt?: number }>): PrivyPort => ({
  async verify(token) { const r = map[token]; if (!r) throw new Error("invalid"); return { did: r.did, expiresAt: r.expiresAt ?? 4_000_000_000 }; },
  async profile(did) { const r = Object.values(map).find((x) => x.did === did); return { email: r?.email ?? null, solanaWallets: [] }; },
});

it("creates the user on first sign-in and bootstraps arrangers from ARRANGER_EMAILS only once", async () => {
  const db = await testDb();
  const p = privy({ t1: { did: "did:privy:a", email: "Ops@Example.com" } });
  const { user } = await signInWithToken(db, p, "t1", parseArrangerEmails(" ops@example.com ,x@example.com"));
  expect(user.email).toBe("ops@example.com");
  expect(user.roles).toEqual(["arranger"]);
});
it("attaches a pre-created (granted by email) user to the Privy DID", ...);  // grantRoleByEmail before sign-in keeps the role
it("resolveSession returns null for a token the verifier rejects", ...);
it("resolveSession reads roles from Postgres on every call (revocation takes effect at once)", ...);
it("refuses a token without an email", ...);           // throws RequestError 403
it("checkRole: signin when null, forbidden without the role, ok with it", ...);
```

`test/routes/session.test.ts` mocks `@/lib/server/db` and `@/lib/server/privy`: POST with `{ token }` sets an httpOnly, SameSite=Lax cookie whose Max-Age ends at the token expiry and returns `{ ok, roles }`; POST with a bad token is 401 and sets no cookie; DELETE clears the cookie.

- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement** `src/lib/auth/session.ts`

```ts
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { userRoles, users, wallets, type Role } from "../db/schema";
import { RequestError } from "../errors";

export const SESSION_COOKIE = "f2f_session";
export interface PrivyPort { verify(token: string): Promise<{ did: string; expiresAt: number }>; profile(did: string): Promise<{ email: string | null; solanaWallets: string[] }> }
export interface SessionUser { id: string; email: string; roles: Role[] }

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const parseArrangerEmails = (v: string | undefined) => (v ?? "").split(",").map(normalizeEmail).filter((e) => e.includes("@"));

async function rolesOf(db: Db, userId: string): Promise<Role[]> {
  return (await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId))).map((r) => r.role).sort();
}

export async function signInWithToken(db: Db, privy: PrivyPort, token: string, arrangerEmails: string[]) {
  let claims;
  try { claims = await privy.verify(token); } catch { throw new RequestError("Sign-in could not be verified. Sign in again.", 401); }
  const existing = await db.query.users.findFirst({ where: eq(users.privyDid, claims.did) });
  let user = existing;
  let profileWallets: string[] = [];
  if (!user) {
    const profile = await privy.profile(claims.did);
    if (!profile.email) throw new RequestError("Sign in with an email address.", 403);
    const email = normalizeEmail(profile.email);
    profileWallets = profile.solanaWallets;
    const byEmail = await db.query.users.findFirst({ where: eq(users.email, email) });
    user = byEmail
      ? (await db.update(users).set({ privyDid: claims.did }).where(eq(users.id, byEmail.id)).returning())[0]
      : (await db.insert(users).values({ email, privyDid: claims.did }).returning())[0];
    if (arrangerEmails.includes(email)) await db.insert(userRoles).values({ userId: user!.id, role: "arranger" }).onConflictDoNothing();
  }
  for (const address of profileWallets) {
    await db.insert(wallets).values({ address, userId: user!.id, kind: "privy-embedded" }).onConflictDoNothing();
  }
  return { user: { id: user!.id, email: user!.email, roles: await rolesOf(db, user!.id) }, expiresAt: claims.expiresAt };
}

export async function resolveSession(db: Db, privy: PrivyPort, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  let did: string;
  try { did = (await privy.verify(token)).did; } catch { return null; }
  const user = await db.query.users.findFirst({ where: eq(users.privyDid, did) });
  return user ? { id: user.id, email: user.email, roles: await rolesOf(db, user.id) } : null;
}

export const checkRole = (u: SessionUser | null, role: Role) => (!u ? "signin" : u.roles.includes(role) ? "ok" : "forbidden");
```

The embedded-wallet sync also runs on every `POST /api/session` (not only first sign-in), because Privy creates the embedded wallet just after the first login: `signInWithToken` always calls `privy.profile` when the user has no `privy-embedded` wallet row yet.

`src/lib/server/privy.ts` wraps `new PrivyClient(appId, secret)`: `verify` uses `verifyAuthToken(token)` and returns `{ did: claims.userId, expiresAt: claims.expiration }`; `profile` uses `getUserById(did)` (`getUser` in 1.32), email from `user.email?.address`, wallets from `linkedAccounts` with `type === "wallet" && chainType === "solana" && walletClientType === "privy"`. Missing app id or secret throws "Privy is not configured: set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET".

`src/lib/server/db.ts`: `getDb()` memoizes `createPgDb(serverEnv().DATABASE_URL)`; throws `DatabaseUnavailable` when unset.

`src/lib/server/auth.ts` reads `cookies().get(SESSION_COOKIE)`; `requireRole` calls `redirect(\`/sign-in?next=${encodeURIComponent(nextPath)}\`)` on "signin".

`POST /api/session`: body `{ token }` (zod, max 4,096 chars), `signInWithToken`, set cookie `{ httpOnly: true, sameSite: "lax", secure: production, path: "/", expires: new Date(expiresAt * 1000) }`, return `{ ok: true, roles }`. `RequestError` → its status and message; database errors → 503 "Accounts are unavailable right now." `DELETE` → delete the cookie.

- [ ] **Step 4: Run tests; suite green.**
- [ ] **Step 5: Commit** `feat(web): Privy session verification and role guard`.

### Task 3: Pure domain helpers (status machine, accrual, statement, wallet link)

**Files:**
- Create: `src/lib/application-status.ts`, `src/lib/accrual.ts`, `src/lib/statement.ts`, `src/lib/wallet-link.ts`
- Test: `test/application-status.test.ts`, `test/accrual.test.ts`, `test/statement.test.ts`, `test/wallet-link.test.ts`

**Interfaces:**
- Produces:
  - `APPLICATION_STATUSES`, `type ApplicationStatus`, `PIPELINE_STATUSES` (the 14 in order), `CHAIN_STATUSES` (open..closed), `STATUS_INFO: Record<ApplicationStatus, { label: string; owner: "farmer" | "arranger" | "investors" | "chain" | null; next: string }>`
  - `canTransition(from, to): boolean` for manual moves; `isChainDerived(s): boolean`
  - `deriveFromChain(detail: PoolDetail, nowSec: number): ApplicationStatus | null` (null for a Draft pool: keep the stored `ready`)
  - `timeline(status): { status; label; state: "done" | "current" | "todo" }[]`
  - `accruedToDate(amount: bigint, couponBps: number, startTs: number, nowSec: number, maturityTs: number): bigint` (Act/360, floors, capped at maturity, 0 before start)
  - `obligation(detail: PoolDetail, vaultBalance: bigint, nowSec: number)` → `{ principal, dueAtMaturity, accrued, maturityTs, election, settlementLabel, buybackFunded: bigint, buybackShortfall: bigint }`
  - `statementCsv(rows: StatementRow[]): string`, `type StatementRow = { date: string; type: string; pool: string; amountUsd: string; tokens: string; signature: string }`
  - `walletLinkMessage(userId: string, wallet: string, issuedAtIso: string): string`, `verifyWalletLink({ userId, wallet, message, signatureBase58, nowMs }): boolean`

- [ ] **Step 1: Write the failing tests.** Key cases:

```ts
// application-status
expect(canTransition("draft", "submitted")).toBe(true);
expect(canTransition("submitted", "open")).toBe(false);
expect(canTransition("open", "withdrawn")).toBe(false);       // chain-derived statuses are never moved by hand
expect(canTransition("kyc", "rejected")).toBe(true);
const d = (over) => ({ pool: { status: "Funded", maturityTs: 2_000, projectCount: 1, disbursedCount: 0, instrument: { supply: "5" } }, projects: [{ disbursed: false, harvestAttested: false, fields: [{ attestationCount: 1 }] }], terms: null, ...over });
expect(deriveFromChain(d({ pool: { ...status Open } }), 1_000)).toBe("open");
expect(deriveFromChain(d({}), 1_000)).toBe("funded");
// disbursed, in_season (a field has more than its FieldVerified attestation), harvest (harvestAttested),
// settlement (maturity passed or Redeeming), closed (Redeeming and supply 0, or Refunding), null for Draft
// accrual: 1,000,000 USDC at 12% for 90 days Act/360 = 30,000 USDC; before start 0; after maturity capped
expect(accruedToDate(1_000_000_000_000n, 1200, 0, 90 * 86_400, 400 * 86_400)).toBe(30_000_000_000n);
// statement: header row, quotes fields with commas or quotes, CRLF line ends, neutralizes leading = + - @ (CSV injection)
// wallet-link: a real Keypair signature verifies; another wallet's signature fails; a message older than 10 minutes fails;
// a message naming another user id fails.
```

- [ ] **Step 2: Run, verify failure.**
- [ ] **Step 3: Implement.** `deriveFromChain`:

```ts
export function deriveFromChain(d: Pick<PoolDetail, "pool" | "projects">, now: number): ApplicationStatus | null {
  const p = d.pool;
  if (p.status === "Draft") return null;
  if (p.status === "Open") return "open";
  if (p.status === "Refunding") return "closed";
  if (p.status === "Redeeming") return BigInt(p.instrument?.supply ?? "1") === 0n ? "closed" : "settlement";
  // Funded
  if (now >= p.maturityTs) return "settlement";
  if (p.disbursedCount < p.projectCount) return "funded";
  if (d.projects.some((x) => x.harvestAttested)) return "harvest";
  if (d.projects.some((x) => x.fields.some((f) => f.attestationCount > 1))) return "in_season";
  return "disbursed";
}
```

`walletLinkMessage` = `Field-to-Finance wants you to link wallet ${wallet} to account ${userId}.\nIssued at: ${iso}` ; verification uses `node:crypto` `verify(null, msg, createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: base64url(pubkeyBytes) }, format: "jwk" }), sig)`.

- [ ] **Step 4: Run, pass.** **Step 5: Commit** `feat(web): application status machine, Act/360 accrual, CSV statement, wallet-link proof`.

### Task 4: Workflow services on Postgres

**Files:**
- Create: `src/lib/workflow/users.ts`, `audit.ts`, `notifications.ts`, `farmer.ts`, `investor.ts`, `arranger.ts`, `ports.ts`
- Test: `test/workflow-users.test.ts`, `test/workflow-farmer.test.ts`, `test/workflow-investor.test.ts`, `test/workflow-arranger.test.ts`

**Interfaces:**
- Consumes: `Db`, schema, `ApplicationStatus` helpers, `SessionUser`.
- Produces (all take `db: Db` first):
  - users: `chooseRole(db, user, role: "farmer" | "investor")` (refuses when the user already has farmer or investor; arrangers may add either), `grantRoleByEmail(db, actor, email, role)`, `revokeRole(db, actor, userId, role)` (refuses own arranger role and the last arranger), `listUsersWithRoles(db)`.
  - audit: `audit(db, entry: { actorUserId: string | null; action: string; targetType: string; targetId: string; payload?: object; signatures?: string[]; error?: string })` (first signature in `tx_signature`, all in payload), `listAudit(db, { limit, targetType?, targetId? })`.
  - notifications: `notify(db, userId, kind, title, body)`, `listNotifications(db, userId, limit)`, `markRead(db, userId)`.
  - farmer: `saveFarmerProfile(db, user, input)`, `submitFarmerKyc(db, user, doc: StoredDocInput)`, `createApplication(db, user, input)` (zod `applicationInput`), `updateApplication`, `addApplicationDocument(db, user, applicationId, kind, doc)` (replaces a rejected or pending document of the same kind; refuses after `submitted` unless the kind was rejected), `attachProject(db, user, applicationId, projectAddress, producer: string)` (producer must be one of the user's wallets), `submitApplication(db, user, id)` (requires profile complete, every required kind uploaded, project attached; moves draft → submitted), `withdrawApplication`, `farmerChecklist(db, applicationId)` → rows per `REQUIRED_KINDS` with `status: "missing" | DocumentStatus`, `farmerOverview(db, userId)`.
  - investor: `saveQuestionnaire(db, user, input)` (category + answers, retail gets `retailLimits`), `submitInvestorKyc(db, user, input)` (mock KYC: full name and country stored in `questionnaire.kyc`), `acknowledgeRisk`, `linkWallet(db, user, { address, kind, proof? })` (unique; refuses an address linked to someone else), `acceptKfd(db, user, poolAddress, documentHash)` (requires approved KYC and risk ack), `kfdGate(db, wallet, poolAddress)` → `null | "unlinked" | "onboarding" | "kfd"`, `investorOnboarding(db, userId)` → step states.
  - arranger: `reviewDocument(db, actor, docId, "accepted" | "rejected", note?)`, `advanceApplication(db, actor, id, to, chain)` (checks `canTransition` and gates: `documents_review → kyc` all required documents accepted; `kyc → field_verification` farmer KYC approved; `field_verification → structuring` every field of the attached project verified on-chain; `structuring → ready` pool attached; `ready → open` only through `publishApplication`), `rejectApplication`, `decideFarmerKyc(db, actor, farmerUserId, decision, chain)` (approved → `chain.approveKyc(wallet)` for the farmer's embedded wallet, then status; records audit with signature), `decideInvestorKyc(db, actor, investorUserId, decision, chain)` (approves every linked wallet on-chain), `verifyApplicationFields(db, actor, id, chain)`, `structureApplication(db, actor, id, terms, chain)` (builds `CreatePoolInput` with the farmer wallet as issuer of record, `chain.createTermPool`, `chain.addProject`, stores pool id and address, moves to `ready`), `publishApplication(db, actor, id, chain)` (`chain.openPool`, status `open`), `refreshChainStatuses(db, chain, nowSec)` (derives and caches statuses for every application with a pool), `pipeline(db)`.
  - ports: `interface ArrangerChain { approveKyc(wallet: string): Promise<string | null>; project(address: string): Promise<ProjectWithFields | null>; verifyFields(project: ProjectWithFields): Promise<string[]>; createTermPool(input: CreatePoolInput): Promise<{ poolId: string; poolAddress: string; signature: string }>; addProject(poolId: string, project: string): Promise<string>; openPool(poolId: string): Promise<string>; pool(poolId: string): Promise<PoolDetail | null>; nextPoolId(): Promise<string> }`.

- [ ] **Step 1: Write failing tests** with a fake `ArrangerChain` that records calls. Required cases: full happy path draft → ready → open on PGlite; every gate refusal message (documents not accepted, KYC pending, fields unverified); audit rows written for each decision including failures (`error` set, no signature); `revokeRole` refuses self and last arranger (Review Focus 3); `linkWallet` refuses a wallet owned by someone else (Review Focus 4); `kfdGate` returns `unlinked`, `onboarding`, `kfd`, then null; farmer cannot read or modify another farmer's application (`RequestError` 404); documents replaced on re-upload after rejection keep the old row as history.
- [ ] **Step 2: Verify failure.** **Step 3: Implement.** **Step 4: Pass.**
- [ ] **Step 5: Commit** `feat(web): workflow services for farmer, investor and arranger`.

### Task 5: Arranger actions, route guards and subscription gate

**Files:**
- Create: `src/app/arranger/actions.ts` (moved from `src/app/admin/actions.ts`, with `run(audit, fn)` that calls `requireActionRole("arranger")` and writes audit), `src/lib/server/chain-port.ts` (`arrangerChain(): ArrangerChain` over `opsContext`, `stubDeps`, `getReader`)
- Modify: imports in `components/admin/*` → `@/app/arranger/actions`; `src/app/api/documents/[hash]/route.ts` (arranger, or the owner of a document row with that hash); `src/app/api/kyc/route.ts` (410 with "Complete onboarding in your investor cabinet"); `src/app/api/tx/[action]/route.ts` (subscribe: `kfdGate`; explained error with action `kfd` or `onboarding`); `src/app/api/tx/send/route.ts` (after a successful send, `audit` with `actorUserId` of the wallet owner, action `tx.<action>`, best effort); `src/lib/chain/explain.ts` (`ErrorAction` gains `onboarding` and `kfd`); `src/components/tx/tx-status.tsx` (renders those as links to `/investor/onboarding` and `/investor/pools/<poolId>`)
- Delete: `src/app/admin/actions.ts`, `src/app/admin/login/*`, `src/lib/admin-auth.ts`; `src/app/admin/page.tsx` becomes `redirect("/arranger")`; `src/app/portfolio/page.tsx` becomes `redirect("/investor")`
- Test: `test/routes/documents.test.ts`, `test/routes/faucet-kyc.test.ts`, `test/routes/subscribe-gate.test.ts`, `test/arranger-actions.test.ts`

- [ ] **Step 1: Failing tests:** an unauthenticated call to `openPoolAction` returns `{ ok: false }` with title "Your session expired. Sign in again." and makes no chain call; an investor gets "Your account does not have the arranger role."; an arranger call writes an audit row with the signature; documents route 401 without session, 200 for owner and arranger, 404 for another farmer; subscribe build returns 403 `{ error: { action: "kfd" } }` when the wallet has no KFD acceptance, and the route still builds `refund` and `redeem` without Postgres.
- [ ] **Step 2–4: Implement and pass.**
- [ ] **Step 5: Commit** `feat(web): arranger-only actions with audit, document access by owner, KFD gate on subscribe`.

### Task 6: Auth UI and cabinet shell

**Files:**
- Create: `src/components/auth/privy-auth.tsx` (client: `PrivyProvider` + bridge exposing `AuthSession { ready, authenticated, email, signer, login, logout }` and a `SessionSync` that posts `getAccessToken()` to `/api/session` on login and every 10 minutes, and deletes it on logout), `src/components/auth/auth-provider.tsx` (dynamic, `ssr: false`, falls back to an "unconfigured" session when `NEXT_PUBLIC_PRIVY_APP_ID` is unset), `src/app/sign-in/page.tsx`, `src/app/sign-in/sign-in-panel.tsx`, `src/app/sign-in/actions.ts` (`chooseRoleAction`), `src/components/cabinet/cabinet-shell.tsx` (title, signed-in email, sign out, tab nav), `src/components/cabinet/no-access.tsx`, `src/components/cabinet/status-timeline.tsx`, `src/components/cabinet/checklist.tsx`
- Modify: `components/wallet/farmer-session.tsx` and `privy-farmer.tsx` (farmer signer now comes from the shared provider), `components/site-header.tsx` (nav: Pools, Investor, Farmer, Arranger), `components/wallet/connect-button.tsx` (`pageHasConnect` uses `/investor`)
- Test: `test/sign-in-panel.test.tsx`, `test/cabinet-shell.test.tsx`, `test/status-timeline.test.tsx`, `test/header-wallet.test.tsx`

Sign-in flow: `/sign-in?next=/arranger` shows one primary button "Continue with email". After Privy login the panel posts the token; with roles it routes to `next` (only same-origin paths starting with `/` and not `//`) or the role's cabinet; without roles it shows two choices, "I am a farmer" and "I am an investor", each a submit button calling `chooseRoleAction`. `NoAccess` (403) names the missing role and says "Ask an arranger to grant the role to <email>".

- [ ] Steps: failing component tests (signed out shows the button; no roles shows two choices; `next=//evil.com` falls back to the cabinet; timeline marks done/current/todo with text, not colour only), implement, pass, commit `feat(web): sign-in, role choice and cabinet shell`.

### Task 7: Farmer cabinet

**Files:**
- Create: `src/app/farmer/layout.tsx` (auth provider), `src/app/farmer/page.tsx` (overview: onboarding progress, applications with status and next action, obligations, payouts and fees, updates), `src/app/farmer/onboarding/page.tsx` (profile form, issuer KYC document, requirement checklist), `src/app/farmer/applications/new/page.tsx`, `src/app/farmer/applications/[id]/page.tsx` (timeline with owner and next action, documents per kind with status and re-upload after rejection, field upload and on-chain registration reusing `GeojsonUpload` and the `register-project` transaction, submit, withdraw), `src/app/farmer/actions.ts`, `src/components/farmer/application-form.tsx`, `src/components/farmer/document-upload.tsx`, `src/components/farmer/register-fields.tsx` (extracted from `farmer-app.tsx`), `src/components/farmer/obligations.tsx`
- Delete: `src/components/farmer/farmer-app.tsx` (its register form moves to `register-fields.tsx`)
- Test: `test/farmer-cabinet.test.tsx`, `test/obligations.test.tsx`, `test/register-fields.test.tsx`

Obligations card per application with a pool: principal raised, due at maturity (`obligation().dueAtMaturity`, floored to the cent), accrued to date, maturity date, settlement election label, buyback funding (vault balance vs due; "Funded" or "Short by $X"). Payouts and fees: disbursement and registration rows from `audit_log` for the application (tx links) plus net payout = requested × (1 − arrangement fee).

- [ ] Steps: failing tests for empty (no applications → "Start your first application"), populated (timeline shows "Next: Upload the missing documents · You"), error (database down → ErrorState), obligations numbers; implement; pass; commit `feat(web): farmer cabinet`.

### Task 8: Investor cabinet

**Files:**
- Create: `src/app/investor/layout.tsx`, `src/app/investor/page.tsx` (summary, onboarding banner until complete, positions per pool with tokens, nominal, accrued coupon, maturity schedule, settlement path, grain claims, history, CSV link), `src/app/investor/onboarding/page.tsx` (questionnaire, mock KYC, risk acknowledgement, wallet link: Privy embedded is linked automatically, Phantom by signed message), `src/app/investor/pools/[poolId]/page.tsx` (key features document: issuer of record, instrument type, nominal, coupon, maturity, settlement path, risks, fees; its SHA-256; "Accept and continue to subscribe"), `src/app/api/investor/statement/route.ts` (CSV, session-bound), `src/app/investor/actions.ts`, `src/components/investor/*`
- Modify: `src/components/pool/invest-panel.tsx` (KYC call to action links to `/investor/onboarding`; `KycDialog` removed), `src/components/portfolio/portfolio-view.tsx` → `src/components/investor/positions.tsx`
- Delete: `src/components/pool/kyc-dialog.tsx`, `test/portfolio-view.test.tsx` (replaced)
- Test: `test/investor-cabinet.test.tsx`, `test/kfd.test.ts`, `test/routes/statement.test.ts`, `test/invest-panel.test.tsx`

Retail investors see: "Retail limits for this exempt offer: fewer than 50 retail investors in 12 months, USD 100,000 minimum per investor, up to USD 5M from retail investors in 12 months." KFD hash = SHA-256 of the canonical JSON of the KFD content, so a changed document needs a new acceptance.

- [ ] Steps: failing tests (onboarding step states; KFD accept requires approved KYC; statement CSV for the session user only, 401 without session; positions with accrued coupon); implement; pass; commit `feat(web): investor cabinet with onboarding, KFD and statement`.

### Task 9: Arranger cabinet

**Files:**
- Create: `src/app/arranger/layout.tsx`, `src/app/arranger/page.tsx` (pipeline board by status with filters `?status=`), `src/app/arranger/applications/[id]/page.tsx` (profile, documents accept/reject, farmer KYC decision, SCAS-stub verification, term builder, publish, audit for this application), `src/app/arranger/investors/page.tsx` (KYC queue with categorization review), `src/app/arranger/pools/page.tsx` (existing `PoolConsole` per pool, create-pool form, verification, onboarding and field import panels from the old console), `src/app/arranger/roles/page.tsx`, `src/app/arranger/audit/page.tsx`, `src/app/arranger/treasury/page.tsx` (`FeesPanel`, key problems, `MintUsdcForm`), `src/components/arranger/*` (pipeline-board, document-review, kyc-decision, term-builder, role-form, audit-table)
- Test: `test/arranger-cabinet.test.tsx`, `test/term-builder.test.tsx`, `test/pipeline-board.test.tsx`

- [ ] Steps: failing tests (board groups by status and shows counts; term builder prefills from the application and refuses a farmer without KYC; role form refuses an invalid email; audit table links signatures to the explorer); implement; pass; commit `feat(web): arranger cabinet`.

### Task 10: Railway Postgres, environment and migrations in pre-deploy

- [ ] Add Postgres: `railway add --database postgres` in project `field-to-finance`; on service `web` set `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `ARRANGER_EMAILS` (user email, from the shell, not committed), confirm `PRIVY_APP_SECRET`; remove `ADMIN_PASSWORD` from Railway and Infisical after deploy.
- [ ] Infisical dev: `DATABASE_URL` = the Postgres public URL (`DATABASE_PUBLIC_URL`), `ARRANGER_EMAILS`.
- [ ] Dockerfile: build `dist/migrate.mjs` with esbuild (`--bundle --platform=node --format=esm --banner` for `createRequire`), copy it and `apps/web/drizzle` into the runtime image; pre-deploy command `node apps/web/dist/migrate.mjs` set through `railway` service config (`RAILWAY_PRE_DEPLOY_COMMAND` is not a thing: use `railway service` settings / the dashboard API via `railway environment edit`, or a `railway.json` scoped to `deploy.preDeployCommand` if the CLI cannot set it; record the choice in a Ruling).
- [ ] Run migrations against Railway from local: `scripts/inf.sh pnpm --filter ./apps/web exec tsx scripts/migrate.ts`.
- [ ] Commit `build(web): migration runner in the image and Railway pre-deploy`.

### Task 11: Devnet end-to-end walk

**Files:** `apps/web/src/lib/demo/cabinet-flow.ts`, `scripts/demo-cabinets.ts`, `test/cabinet-flow.test.ts`, `docs/devlog/2026-10-05.md`

The script creates fake users directly through the workflow (farmer `demo+farmer-<ts>@example.com`, investor `demo+investor-<ts>@example.com`, acting arranger `demo+arranger-<ts>@example.com`), keypairs for the farmer and investor wallets, and walks: farmer profile (fake values) → application → document uploads (generated PDFs with fake text) → register fields (sponsored transaction signed by the farmer keypair) → submit → arranger review, accept documents, farmer KYC (on-chain approval) → SCAS-stub verification → structure (pool + InstrumentTerms + add project) → publish (open) → investor questionnaire, KYC approval (on-chain), risk ack, wallet link, KFD → subscribe the whole issue (sponsored, signed by the investor keypair) → close subscription → disburse. Prints each step with explorer links; derives and caches statuses; ends at `disbursed`.

- [ ] Steps: failing unit test for step ordering with fakes; implement; run on devnet with `scripts/inf.sh pnpm tsx scripts/demo-cabinets.ts`; paste links into the devlog; commit `feat: devnet walk through the cabinets`.

### Task 12: Docs

- [ ] `docs/systems/web.md` (cabinets, auth, data, routes table, security notes; remove ADMIN_PASSWORD), new `docs/systems/data.md` (schema, migrations, privacy, retention), flows `docs/flows/farmer-onboarding.md`, `investor-onboarding.md`, `issuance-pipeline.md`, ADR `0016-privy-role-login-and-postgres.md` (Accepted, user decision 2026-10-05), ADR index, `docs/README.md`, `docs/business/CONTEXT.md` link, glossary terms (Cabinet, Key Features Document, Application), devlog.
- [ ] Commit `docs: role cabinets, data system, onboarding and issuance flows, ADR 0016`.

### Task 13: Visual QA

- [ ] Screenshots at 1440px and 390px of `/sign-in`, `/farmer`, `/farmer/applications/<id>`, `/investor`, `/investor/onboarding`, `/arranger`, `/arranger/applications/<id>`, `/arranger/investors`, `/arranger/roles`, `/arranger/audit` with the headless shell against `next dev -p 3300` (basic auth header from env). Privy email OTP cannot run headless, so `src/lib/server/privy.ts` has a dev verifier: only when `NODE_ENV !== "production"` and `F2F_DEV_AUTH=1`, a token `dev:<email>` verifies as DID `did:dev:<email>` (test `test/privy-dev.test.ts` pins that production ignores the flag). The screenshot script posts such a token to `/api/session` and reuses the cookie. Data comes from the devnet walk (Task 11) in the Railway Postgres. Run `screen-critique`, fix P1s, then a `better-interface` review by a fresh subagent; fix its blocking findings.
- [ ] Commit `fix(web): visual QA of the cabinets`.

### Task 14: Final review, merge and deploy

- [ ] Push branch; fresh reviewer (model `fable`): auth and role bypass, server action authorization, PII leakage, migration safety, regressions. Fix Critical and Important with tests.
- [ ] Fast-forward `main`, push, delete the remote branch, `railway up --service web`, verify deployment SUCCESS, `/api/health` 200, 401 without basic auth, cabinets and `/sign-in` render with basic auth, migration applied.
- [ ] Bump the submodule pointer in the parent monorepo, commit and push.

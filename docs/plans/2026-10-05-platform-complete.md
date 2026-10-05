# Complete Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every step of a pool's life, from a farmer's application to the last redemption or Grain Claim, is done by the right role in its own cabinet: new compliance, SCAS partner, elevator and lab, and read-only regulator cabinets; farmer settlement from the web; an arranger lifecycle board; investor settlement actions; season and harvest blocks on the public pool page; in-app notifications; RPC 429 resilience.

**Architecture:** Five service roles join `farmer`, `investor`, `arranger` in `user_roles`. Arrangers grant them by email; an arranger may act for any service role and the audit row records the role acted as (`audit_log.acting_role`). Business rules stay in framework-free workflow modules (`src/lib/workflow/*`) over a Drizzle `Db` and narrow chain ports, so server actions, PGlite tests and the devnet walk run the same code. The program is unchanged: compliance reuses `approve_investor`/`revoke_investor`, the SCAS cabinet `record_attestation` (Sowing, Vegetation, Harvest; the pre-harvest yield estimate is a Harvest attestation whose evidence carries the estimate), elevator and lab `record_delivery`, the farmer signs `elect_settlement` and `fund_redemption` from the Privy wallet as sponsored user transactions, the arranger closes, disburses, records settlement, opens redemption and sweeps.

**Tech Stack:** existing (Next.js 16.3.8, React 19.3.0, Tailwind 4.3.3, zod 4.6.5, Drizzle 0.45.3, PGlite 0.5.8, vitest 5.0.3, @solana/web3.js 1.99.0). No new dependencies.

**Spec:** [docs/specs/2026-10-05-platform-complete.md](../specs/2026-10-05-platform-complete.md), building on [role cabinets](../specs/2026-10-05-role-cabinets.md). Read with [web.md](../systems/web.md), [data.md](../systems/data.md), [program.md](../systems/program.md), ADRs 0011 to 0016.

## Global Constraints

- Roles: `farmer`, `investor`, `arranger`, plus service roles `compliance`, `scas`, `elevator`, `lab`, `regulator`. Service roles are granted only by an arranger (by email, Roles tab), never self-chosen; one user may hold several.
- An arranger may act for any service role; every such action writes `audit_log.acting_role` with the role acted as. A service user acting in its own role also writes `acting_role`.
- Cabinets: `/compliance`, `/scas`, `/elevator` (elevator and lab roles), `/regulator` (read-only). Arrangers can open all four.
- On-chain program: reuse existing instructions only; no account layout change; no new instruction. (If one is ever needed: litesvm tests, append-only enums, `anchor deploy` in place with opt-level s, F2F keys from `~/.config/f2f/`.)
- Postgres changes only through new additive Drizzle migrations. Tests on PGlite. Never touch the production Railway Postgres or Railway settings.
- Private identifiers (BIN, IIN, legal names, cadastral numbers, emails) never on-chain, in the repo, logs, PostHog or GlitchTip. The regulator sees BIN and IIN in its cabinet and exports; no other role's view gains them. Demo data obviously fake (`Demo Farm LLP`, BIN `000000000000`, IIN `000000000000`, `demo+...@example.com`).
- `.tastemaker/style-lock.md` (dark "Night field") is law: tokens from `globals.css`, no hex in components, no `dark:` variants, one wheat primary action per screen, 24px heading ceiling, no nested panels, tabular numbers, mono only for addresses, hashes, signatures. 390px without horizontal page scroll.
- Modules under `apps/web/src/lib/` outside `src/lib/server/` use relative imports (the devnet scripts import them through `tsx`). `src/lib/server/*` starts with `import "server-only"`.
- UI copy in English, sentence case, no em dashes.
- Commits end with a blank line and `Claude-Session: https://claude.ai/code/session_01ME22MMec3RnxBQUt7ynVd7`. Never force-push.

## Review Focus

1. **A service role acting outside its lane** (a `scas` user calling a compliance action, a `lab` user recording an elevator receipt, a `regulator` calling any write): refused with 403 and nothing sent on-chain. Tests in Tasks 2, 4, 5, 6, 7.
2. **Regulator export leaking audit payloads** (KYC rejection notes, documents, emails in `payload`): the events export carries only whitelisted payload keys; the holders export carries category and IIN but never emails or names. Test in Task 7.
3. **Farmer settlement transaction built for someone else** (a farmer wallet that is not the pool's issuer of record, or a self-built `fund_redemption` that moves USDC from another wallet or names a foreign vault): refused before signing by `/api/tx/<action>` and by the sponsor validator. Tests in Task 8.
4. **Duplicate notifications on every page load** (maturity reminder computed on load): `notifyOnce` with a dedupe key writes one row however often it runs. Test in Task 3.
5. **Public RPC 429 storms** (devnet answers 429 for program scans): reads retry with backoff honouring `Retry-After`, and a pool list read that still fails serves the last good value instead of an error page. Test in Task 1.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/chain/rpc-fetch.ts` | fetch wrapper with 429/5xx retry and backoff for the web3 Connection |
| `src/lib/ttl-cache.ts`, `src/lib/chain/reader.ts` | stale-on-error list cache; `poolAttestations`, `holders` reads |
| `src/lib/db/schema.ts`, `drizzle/0002_service_roles.sql` | service roles, `audit_log.acting_role`, notification dedupe key and link, investor `iin` lives in the questionnaire JSON |
| `src/lib/roles.ts` | role lists, labels, cabinet paths (relative-import safe) |
| `src/lib/workflow/guards.ts` | `assertServiceRole`, `ServiceActor` |
| `src/lib/server/auth.ts`, `components/cabinet/guard.tsx` | `requireServiceAction`, `guardServiceCabinet` |
| `src/lib/workflow/notifications.ts` | `notifyOnce`, `unreadCount`, `notifyPoolInvestors`, `notifyApprovedInvestors`, `maturityReminders` |
| `components/cabinet/notification-bell.tsx` | bell with unread count in every cabinet |
| `src/lib/workflow/compliance.ts`, `app/compliance/*` | KYC queues and decisions, revocations, retail monitor |
| `src/lib/workflow/scas.ts`, `app/scas/*` | verification queue, season attestations with evidence, timeline |
| `src/lib/lab-quality.ts`, `src/lib/workflow/delivery.ts`, `app/elevator/*` | 12-parameter evaluation, elevator receipt and lab protocol |
| `src/lib/workflow/regulator.ts`, `src/lib/csv.ts`, `app/regulator/*`, `app/api/regulator/export/route.ts` | registry, holders, events, CSV |
| `src/lib/chain/user-tx.ts`, `src/lib/chain/sponsor.ts`, `components/farmer/settlement-actions.tsx` | farmer `elect-settlement`, `fund-redemption` |
| `src/lib/lifecycle.ts`, `components/arranger/lifecycle-board.tsx` | per-pool phase stepper with next action and owner |
| `components/investor/grain-claims.tsx`, `components/pool/season-block.tsx` | grain claim certificates, public season and harvest blocks |
| `src/lib/demo/lifecycle-flow.ts`, `scripts/demo-lifecycle.ts` | devnet walk of both settlement paths |

---

### Task 1: RPC resilience

**Files:** Create `src/lib/chain/rpc-fetch.ts`, `test/rpc-fetch.test.ts`. Modify `src/lib/ttl-cache.ts`, `src/lib/chain/reader.ts`, `src/lib/server/context.ts`, `test/ttl-cache.test.ts`.

**Interfaces:** Produces `retryingFetch(inner?: typeof fetch, opts?: { retries?: number; baseMs?: number; maxMs?: number; sleep?: (ms: number) => Promise<void> }): typeof fetch`; `createTtlCache(ttlMs, now?, opts?: { staleOnError?: (key: string) => boolean })`; reader option `listTtlMs` (default 20 s) for the `pools` and `unpooled` keys.

- [ ] **Step 1: failing tests**

```ts
// test/rpc-fetch.test.ts
import { describe, expect, it, vi } from "vitest";
import { retryingFetch } from "../src/lib/chain/rpc-fetch";

const res = (status: number, headers: Record<string, string> = {}) => new Response(status === 200 ? "{}" : "busy", { status, headers });

describe("retryingFetch", () => {
  it("retries 429 with backoff and returns the first success", async () => {
    const inner = vi.fn().mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(200));
    const sleeps: number[] = [];
    const f = retryingFetch(inner as unknown as typeof fetch, { baseMs: 100, sleep: async (ms) => void sleeps.push(ms) });
    expect((await f("https://rpc", { method: "POST", body: "{}" })).status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(3);
    expect(sleeps[0]).toBeGreaterThanOrEqual(100);
    expect(sleeps[1]).toBeGreaterThanOrEqual(200);
  });
  it("honours Retry-After seconds, capped", async () => {
    const inner = vi.fn().mockResolvedValueOnce(res(429, { "retry-after": "2" })).mockResolvedValueOnce(res(200));
    const sleeps: number[] = [];
    await retryingFetch(inner as unknown as typeof fetch, { sleep: async (ms) => void sleeps.push(ms) })("https://rpc");
    expect(sleeps).toEqual([2000]);
  });
  it("gives up after the retry budget and returns the last 429", async () => {
    const inner = vi.fn().mockResolvedValue(res(429));
    const r = await retryingFetch(inner as unknown as typeof fetch, { retries: 2, baseMs: 1, sleep: async () => {} })("https://rpc");
    expect(r.status).toBe(429);
    expect(inner).toHaveBeenCalledTimes(3);
  });
  it("does not retry other client errors", async () => {
    const inner = vi.fn().mockResolvedValue(res(400));
    await retryingFetch(inner as unknown as typeof fetch, { sleep: async () => {} })("https://rpc");
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
```

Add to `test/ttl-cache.test.ts`:

```ts
it("serves the last good value when a reload fails and staleOnError allows the key", async () => {
  let t = 0;
  const c = createTtlCache(10, () => t, { staleOnError: (k) => k === "pools" });
  expect(await c.get("pools", async () => 1)).toBe(1);
  t = 20;
  expect(await c.get("pools", async () => { throw new Error("429"); })).toBe(1);
  await expect(c.get("other", async () => { throw new Error("429"); })).rejects.toThrow("429");
});
```

- [ ] **Step 2:** `pnpm --filter ./apps/web exec vitest run test/rpc-fetch.test.ts test/ttl-cache.test.ts` → FAIL (module missing).
- [ ] **Step 3: implementation**

```ts
// src/lib/chain/rpc-fetch.ts
export interface RetryOptions { retries?: number; baseMs?: number; maxMs?: number; sleep?: (ms: number) => Promise<void> }
const RETRY = new Set([429, 502, 503, 504]);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Public devnet RPC answers 429 under load: retry with exponential backoff and jitter, honouring Retry-After (capped). */
export function retryingFetch(inner: typeof fetch = fetch, o: RetryOptions = {}): typeof fetch {
  const retries = o.retries ?? 4, base = o.baseMs ?? 400, max = o.maxMs ?? 8_000, sleep = o.sleep ?? wait;
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    let last: Response | undefined;
    for (let attempt = 0; ; attempt++) {
      last = await inner(input, init);
      if (!RETRY.has(last.status) || attempt >= retries) return last;
      const after = Number(last.headers.get("retry-after"));
      const backoff = Number.isFinite(after) && after > 0 ? after * 1000 : base * 2 ** attempt + Math.floor(Math.random() * base * 0.25);
      await sleep(Math.min(backoff, max));
    }
  }) as typeof fetch;
}
```

`ttl-cache.ts`: keep the last fulfilled value per key (`good: Map<string, unknown>`); on a load rejection for a key where `staleOnError(key)` is true and a good value exists, resolve with it. `reader.ts`: `createChainReader({..., listTtlMs = 20_000})` keeps a second cache `lists = createTtlCache(listTtlMs, Date.now, { staleOnError: () => true })` for `pools` and `unpooled`; `invalidate()` clears both (stale good values survive `clear()` only for staleOnError, so the next failing reload after a transaction still serves something). `context.ts`: `new Connection(url, { commitment: "confirmed", fetch: retryingFetch(), disableRetryOnRateLimit: true })`.

- [ ] **Step 4:** tests PASS; full web suite PASS.
- [ ] **Step 5:** commit `feat(web): retry public RPC 429s with backoff and serve the last pool list on failure`.

### Task 2: Service roles, acting role and guards

**Files:** Create `src/lib/roles.ts`, `drizzle/0002_service_roles.sql` (generated), `test/service-roles.test.ts`. Modify `src/lib/db/schema.ts`, `src/lib/workflow/guards.ts`, `src/lib/workflow/audit.ts`, `src/lib/workflow/users.ts`, `src/lib/server/auth.ts`, `components/cabinet/guard.tsx`, `components/cabinet/no-access.tsx`, `src/lib/auth/redirects.ts`, `src/lib/cabinet-redirect.ts`, `app/arranger/workflow-actions.ts` (grant/revoke validation), `components/arranger/role-form.tsx`, `src/lib/audit-labels.ts`, `components/arranger/audit-table.tsx`.

**Interfaces:**
- `ROLES = ["farmer","investor","arranger","compliance","scas","elevator","lab","regulator"]`, `SERVICE_ROLES = ["compliance","scas","elevator","lab","regulator"] as const`, `type ServiceRole`.
- `roles.ts`: `ROLE_LABELS: Record<Role,string>`, `ROLE_CABINET: Record<Role,string>` (`elevator` and `lab` → `/elevator`).
- `assertServiceRole(user: SessionUser, role: ServiceRole): ServiceActor` where `ServiceActor = { user: SessionUser; role: ServiceRole; viaArranger: boolean }`; throws 403 unless the user has `role` or `arranger`.
- `AuditEntry.actingRole?: string` written to `audit_log.acting_role`.
- `requireServiceAction(role): Promise<ServiceActor>`; `guardServiceCabinet(roles: ServiceRole[], path): Promise<{ user; roles: ServiceRole[] } | { element }>` (`roles` = the service roles the user may act as on that page; arranger gets all listed).
- `notifications.dedupe_key text` (unique where not null), `notifications.link text`.

- [ ] **Step 1: failing tests**

```ts
// test/service-roles.test.ts
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLog, notifications } from "../src/lib/db/schema";
import { audit } from "../src/lib/workflow/audit";
import { assertServiceRole } from "../src/lib/workflow/guards";
import { grantRoleByEmail } from "../src/lib/workflow/users";
import { cabinetFor } from "../src/lib/auth/redirects";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

const db = await testDb();
const ops = await makeUser(db, "ops@example.com", ["arranger"]);
const scas = await makeUser(db, "scas@example.com", ["scas"]);

describe("service roles", () => {
  it("an arranger grants every service role by email; the row passes the role check", async () => {
    for (const r of ["compliance", "scas", "elevator", "lab", "regulator"] as const) await grantRoleByEmail(db, ops, `svc-${r}@example.com`, r);
  });
  it("a service user cannot grant roles", async () => {
    await expect(grantRoleByEmail(db, scas, "x@example.com", "compliance")).rejects.toMatchObject({ status: 403 });
  });
  it("assertServiceRole: own role ok, arranger acts for any, other roles refused", () => {
    expect(assertServiceRole(scas, "scas")).toMatchObject({ role: "scas", viaArranger: false });
    expect(assertServiceRole(ops, "lab")).toMatchObject({ role: "lab", viaArranger: true });
    expect(() => assertServiceRole(scas, "compliance")).toThrow(/compliance/);
  });
  it("audit rows record the acting role", async () => {
    await audit(db, { actorUserId: ops.id, actingRole: "compliance", action: "test.act", targetType: "user", targetId: ops.id });
    const [row] = await db.select().from(auditLog).where(eq(auditLog.action, "test.act"));
    expect(row?.actingRole).toBe("compliance");
  });
  it("a notification dedupe key is unique", async () => {
    await db.insert(notifications).values({ userId: ops.id, kind: "k", title: "t", body: "b", dedupeKey: "once" });
    await expect(db.insert(notifications).values({ userId: ops.id, kind: "k", title: "t", body: "b", dedupeKey: "once" })).rejects.toThrow();
  });
  it("service users land in their own cabinet", () => {
    expect(cabinetFor(["lab"])).toBe("/elevator");
    expect(cabinetFor(["regulator"])).toBe("/regulator");
  });
});
```

- [ ] **Step 2:** run → FAIL (role check, columns missing).
- [ ] **Step 3:** schema: extend `ROLES`; `auditLog.actingRole: text("acting_role")`; `notifications.dedupeKey: text("dedupe_key")`, `notifications.link: text("link")`, `uniqueIndex("notifications_dedupe").on(t.dedupeKey).where(sql\`"dedupe_key" is not null\`)`. Generate: `cd apps/web && pnpm exec drizzle-kit generate --name service_roles` (drops and re-adds `user_roles_role` with the new list, adds the columns and index: additive). `guards.ts`:

```ts
export type ServiceActor = { user: SessionUser; role: ServiceRole; viaArranger: boolean };
export function assertServiceRole(user: SessionUser, role: ServiceRole): ServiceActor {
  if (user.roles.includes(role)) return { user, role, viaArranger: false };
  if (user.roles.includes("arranger")) return { user, role, viaArranger: true };
  throw new RequestError(`Your account does not have the ${role} role.`, 403);
}
```

`audit()` writes `actingRole: e.actingRole ?? null`. `cabinetFor`: arranger, farmer, investor, then compliance, scas, elevator/lab, regulator. `cabinetRedirect` CABINET regex adds `compliance|scas|elevator|regulator`. `requireServiceAction(role)` = `assertServiceRole(await requireSignedIn(), role)` mapping missing role to the same 403 message. `guardServiceCabinet` mirrors `guardCabinet`: signed out → redirect; Postgres down → error state; no allowed role → `NoAccess` (PLURAL map extended). Role form select lists all roles with labels. Audit table shows "as compliance" next to the actor when `actingRole` is set.
- [ ] **Step 4:** tests PASS; suite PASS (`test/db-schema.test.ts` must stay green with the new migration).
- [ ] **Step 5:** commit `feat(web): service roles granted by arrangers, acting role in the audit log`.

### Task 3: In-app notifications

**Files:** Modify `src/lib/workflow/notifications.ts`, `src/lib/workflow/arranger.ts` (document accepted, pool opened), `src/lib/server/tx-history.ts` (subscription confirmed, grain claim, election, buyback funded), `components/cabinet/cabinet-shell.tsx`; create `components/cabinet/notification-bell.tsx`, `app/notifications-actions.ts`, `test/notifications.test.ts`, `test/notification-bell.test.tsx`.

**Interfaces:**
- `notify(db, userId, kind, title, body, link?: string)`.
- `notifyOnce(db, userId, dedupeKey, kind, title, body, link?): Promise<boolean>` (insert on conflict do nothing; true when written).
- `unreadCount(db, userId): Promise<number>`.
- `notifyPoolInvestors(db, poolAddress, kind, title, body, link?)` → every user with a KFD acceptance for the pool.
- `notifyApprovedInvestors(db, kind, title, body, link?)` → every investor profile with KYC approved.
- `maturityReminders(db, pools: { address: string; poolId: string; symbol: string; maturityTs: number }[], nowSec, farmerOfPool: Map<string, string>)` → for pools maturing within 7 days and not yet matured: `notifyOnce` per investor (KFD acceptors) and the farmer, key `maturity7:<pool>:<user>`.
- `markRead(db, userId)`; `markAllReadAction()` server action (any signed-in user, own rows only).
- `CabinetShell` gains `userId: string` and renders `<NotificationBell userId>` (async server component: unread count + latest 8, client popover).

Events wired: role granted (exists), document accepted (new) and rejected (exists), KYC decided (exists), application status changed (exists), pool opened (`publishApplication` → `notifyApprovedInvestors`), subscription confirmed (`recordUserTx` `subscribe`), disbursed (status change already notifies the farmer; add explicit title "Proceeds paid"), attestation recorded (Task 5 → farmer and KFD acceptors), election made (Task 8 + arranger elect → farmer and acceptors), buyback funded (Task 8 → acceptors), maturity approaching (page loads of farmer and investor cabinets call `maturityReminders`), grain claim recorded (`recordUserTx` `redeem-delivery`).

- [ ] **Step 1: failing tests**

```ts
// test/notifications.test.ts
import { describe, expect, it } from "vitest";
import { investorProfiles, kfdAcceptances } from "../src/lib/db/schema";
import { listNotifications, maturityReminders, notifyApprovedInvestors, notifyOnce, notifyPoolInvestors, unreadCount, markAllRead } from "../src/lib/workflow/notifications";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

const db = await testDb();
const a = await makeUser(db, "a@example.com", ["investor"]);
const b = await makeUser(db, "b@example.com", ["investor"]);
const farmer = await makeUser(db, "f@example.com", ["farmer"]);
await db.insert(investorProfiles).values([{ userId: a.id, kycStatus: "approved" }, { userId: b.id, kycStatus: "pending" }]);
await db.insert(kfdAcceptances).values({ investorUserId: a.id, poolAddress: "PoolA", documentHash: "0".repeat(64) });

describe("notifications", () => {
  it("notifyOnce writes one row per key", async () => {
    expect(await notifyOnce(db, a.id, "k1", "x", "T", "B")).toBe(true);
    expect(await notifyOnce(db, a.id, "k1", "x", "T", "B")).toBe(false);
    expect((await listNotifications(db, a.id)).filter((n) => n.title === "T")).toHaveLength(1);
  });
  it("pool and approved-investor fan-out reach only the right users", async () => {
    await notifyPoolInvestors(db, "PoolA", "pool", "Election made", "Buyback");
    await notifyApprovedInvestors(db, "pool", "Pool opened", "New pool");
    expect((await listNotifications(db, a.id)).map((n) => n.title)).toEqual(expect.arrayContaining(["Election made", "Pool opened"]));
    expect(await listNotifications(db, b.id)).toHaveLength(0);
  });
  it("maturity reminder: once, only inside 7 days, to holders and the farmer", async () => {
    const now = 1_000_000;
    const pools = [{ address: "PoolA", poolId: "1", symbol: "F2F1", maturityTs: now + 3 * 86_400 }, { address: "PoolB", poolId: "2", symbol: "F2F2", maturityTs: now + 30 * 86_400 }];
    const farmers = new Map([["PoolA", farmer.id]]);
    await maturityReminders(db, pools, now, farmers);
    await maturityReminders(db, pools, now, farmers);
    expect((await listNotifications(db, farmer.id)).filter((n) => n.kind === "maturity")).toHaveLength(1);
    expect((await listNotifications(db, a.id)).filter((n) => n.kind === "maturity")).toHaveLength(1);
  });
  it("unread count and mark all read", async () => {
    expect(await unreadCount(db, a.id)).toBeGreaterThan(0);
    await markAllRead(db, a.id);
    expect(await unreadCount(db, a.id)).toBe(0);
  });
});
```

Plus a jsdom test that the bell shows "3 unread" as its accessible name and lists titles when opened, and a test in `workflow-arranger.test.ts` that accepting a document notifies the owner.

- [ ] **Step 2:** FAIL. **Step 3:** implement (drizzle `onConflictDoNothing({ target: notifications.dedupeKey, where: sql\`dedupe_key is not null\` })` → use `.returning()` length). Bell: `Bell` icon button 36px, wheat dot with count, popover panel (surface, hairline, popover shadow, 160ms ease-out opacity+translate, reduced motion opacity only), list items title + time + body, "Mark all read" ghost button, Escape and outside click close, `aria-expanded`. **Step 4:** PASS. **Step 5:** commit `feat(web): notification bell in every cabinet and lifecycle notifications`.

### Task 4: Compliance cabinet

**Files:** Create `src/lib/workflow/compliance.ts`, `app/compliance/{layout,page}.tsx`, `app/compliance/investors/page.tsx`, `app/compliance/limits/page.tsx`, `app/compliance/actions.ts`, `components/compliance/tabs.ts`, `test/workflow-compliance.test.ts`, `test/compliance-actions.test.ts`. Modify `src/lib/workflow/arranger.ts` (move `decideFarmerKyc`/`decideInvestorKyc` to take a `ServiceActor` checked for `compliance`), `src/lib/workflow/ports.ts` (`revokeKyc(wallet, poolIds: string[]): Promise<string[]>`), `src/lib/chain/arranger-chain.ts`, `app/arranger/workflow-actions.ts` (KYC actions removed; arranger uses `/compliance`), `app/arranger/investors/page.tsx` (read view), `app/arranger/applications/[id]/page.tsx` (KYC decision → link "Decide in the compliance cabinet"), `src/lib/workflow/investor.ts` (`iin` optional in KYC input), `components/investor/onboarding-steps.tsx` (IIN field), `src/lib/demo/cabinet-flow.ts`, `test/helpers/workflow.ts` (`revokeKyc` fake).

**Interfaces:**
- `decideFarmerKyc(db, actor: ServiceActor, farmerUserId, decision, note, chain)` and `decideInvestorKyc(...)` same signature change; both `assert actor.role === "compliance"` (via `complianceActor(user)` = `assertServiceRole(user,"compliance")`) and audit `actingRole`.
- `revokeInvestor(db, actor, investorUserId, reason, chain, poolIdsHeld: (wallet) => Promise<string[]>)`: for each linked wallet calls `chain.revokeKyc(wallet, poolIds)` (at least one pool), sets `kycStatus: "rejected"`, `kycNote: "Revoked: <reason>"`, audits `investor_kyc.revoke`, notifies.
- `complianceQueues(db)` → `{ farmers: FarmerKycRow[], investors: InvestorQueueRow[], approvedInvestors: InvestorQueueRow[] }`.
- `retailMonitor(db, pools: {address, poolId, symbol}[])` → per pool `{ retailInvestors, limit: 50, perInvestor: { userId, email, amountUsd: bigint }[] }` from `tx.subscribe` audit rows joined with investor category; flags investors below USD 100,000 minimum.
- `investorKycInput` gains `iin: z.string().regex(/^\d{12}$/).optional()` ("12 digits").

- [ ] **Step 1: failing tests** (`workflow-compliance.test.ts`): a compliance user approves investor KYC (fake chain `approveKyc` called, audit `actingRole: "compliance"`); an arranger does the same and the audit shows `actingRole: "compliance"`; a `scas` user is refused 403 and the fake chain is not called; revoke calls `revokeKyc` for every linked wallet with the held pools (or the fallback first pool) and marks the profile; the retail monitor counts distinct retail subscribers per pool and lists amounts. `compliance-actions.test.ts` mocks `@/lib/server/auth` like `arranger-workflow-actions.test.ts` and asserts signed-out → "Sign in again", investor → 403 text, compliance → ok.
- [ ] **Step 2:** FAIL. **Step 3:** implement; `arranger-chain.revokeKyc` uses `revokeInvestor(ops, poolId, wallet)` per pool. Cabinet: tabs "Issuer KYC" (`/compliance`), "Investor KYC" (`/compliance/investors`), "Retail limits" (`/compliance/limits`); reuse `Decision` component (`components/arranger/decision.tsx`) with the compliance actions; documents links reuse `/api/documents/[hash]` (served to compliance users too: extend the route's reader check to `arranger | compliance`). Revocation: outline danger button with inline confirmation naming the consequence ("Revoke and freeze holdings"). **Step 4:** PASS. **Step 5:** commit `feat(web): compliance cabinet with KYC queues, revocations and the retail limit monitor`.

### Task 5: SCAS partner cabinet

**Files:** Create `src/lib/workflow/scas.ts`, `app/scas/{layout,page}.tsx`, `app/scas/pools/[poolId]/page.tsx`, `app/scas/actions.ts`, `components/scas/attest-form.tsx`, `components/scas/season-timeline.tsx`, `test/workflow-scas.test.ts`, `test/scas-actions.test.ts`. Modify `src/lib/scas-stub.ts` (optional `note`, `documentSha256`, `yieldEstimateTPerHa` in evidence; `attestOne(deps, {project, fieldIndex, kind, extra})`), `src/lib/chain/filters.ts` (`attestationsOfProject`), `src/lib/chain/reader.ts` (`poolAttestations(poolId)`), `src/lib/workflow/arranger.ts` (`verifyApplicationFields` takes a `ServiceActor` for `scas`), `src/lib/workflow/ports.ts` (`attest(input: SeasonAttestInput): Promise<string[]>`), `src/lib/chain/arranger-chain.ts`, `app/arranger/applications/[id]/page.tsx` (verification → link to SCAS cabinet).

**Interfaces:**
- `SEASON_KINDS = ["Sowing", "Vegetation", "Harvest"] as const`; label for Harvest: "Pre-harvest yield estimate and harvest".
- `SeasonAttestInput = { poolId: string; kind: SeasonKind; note: string | null; documentSha256: string | null; yieldEstimateTPerHa: number | null }`.
- `recordSeasonAttestation(db, actor: ServiceActor, input, chain): Promise<string[]>`: role `scas`; pool must exist, be Funded or Redeeming (`seasonAttestationBlocker`); Harvest requires `yieldEstimateTPerHa` (0.1–20); audits `pool.attest_stage` with `actingRole`; notifies the farmer (application by pool id) and KFD acceptors.
- `scasQueue(db, chain)` → applications in `field_verification` with project and field counts.
- `poolAttestations(poolId)` → `AttestationView[]` of every field of every project of the pool, sorted by `recordedAt`.

- [ ] **Step 1: failing tests**: scas user records Vegetation (fake chain `attest` called with the input, audit `actingRole: "scas"`, farmer notified); Harvest without a yield estimate → 400; a pool still Open → 409 with the blocker text; an elevator user → 403; `verifyApplicationFields` by a scas user works and by a lab user is refused. Action test as in Task 4.
- [ ] **Step 2:** FAIL. **Step 3:** implement. Evidence file upload (optional) goes to `documents/<sha>` through `storeDocument`; its hash goes into the evidence JSON (the attestation's on-chain hash is the evidence JSON hash). SCAS home: verification queue (application, region from profile is **not** shown, only crop, season, field count, polygon hashes, declared areas from the field set) with "Verify fields" (primary) and the MapLibre field view (`FieldMapLoader` with polygons from `/api/polygons/<hash>`); pool list with "Open season" link. Pool page: attest form (kind select, note, optional file, yield estimate when Harvest) and the season timeline (by field, kind, verdict, date, explorer link, evidence link). **Step 4:** PASS. **Step 5:** commit `feat(web): SCAS partner cabinet with verification queue, season attestations and timeline`.

### Task 6: Elevator and lab cabinet, lab pass/fail

**Files:** Create `src/lib/lab-quality.ts`, `src/lib/workflow/delivery.ts`, `app/elevator/{layout,page}.tsx`, `app/elevator/actions.ts`, `components/elevator/receipt-form.tsx`, `components/elevator/lab-form.tsx`, `test/lab-quality.test.ts`, `test/workflow-delivery.test.ts`, `test/elevator-actions.test.ts`. Modify `src/lib/pilot-docs.ts` (`DeliveryEvidence` optional `receiptNumberSha256`, `receivedOn`, `measurements`, `results`), `src/lib/workflow/ports.ts` (`recordDelivery(poolId, input: DeliveryRecordInput): Promise<string>`), `src/lib/chain/arranger-chain.ts`.

**Interfaces:**
- `parseRequirement(req: string): Rule` where `Rule = { op: "min" | "max" | "eq"; value: number; unit: string } | { op: "text"; expected: string }`. "≥ 30%" → min 30; "≤ 2%" → max 2; "14% (12%)" → max 14; "≥ 200 s" → min 200; "None" → text "none"; "Wheat" → text "wheat"; "HiPro (class 3)" → text.
- `evaluateLab(spec: QualitySpec, measured: Record<string, string>): { results: { key; label; requirement; measured; pass: boolean | null }[]; verdict: "Pass" | "Fail" | "InsufficientData" }` (missing or unparsable measurement → `pass: null` → InsufficientData unless another parameter fails → Fail).
- `recordElevatorReceipt(db, actor, { poolId, tonnes, receiptNumber, receivedOn, file }, chain, store)` role `elevator`: stores the file, hashes the receipt number (`sha256` hex; the number itself is never stored), evidence `{kind: ElevatorReceipt, verdict: Pass, kg, receiptNumberSha256, receivedOn, documentSha256}`; then `chain.recordDelivery`.
- `recordLabProtocol(db, actor, { poolId, measured, file }, chain, store, spec)` role `lab`: `evaluateLab`, evidence `{kind: LabQuality, verdict, measurements, results, documentSha256}`, `chain.recordDelivery`. Both audit `pool.record_delivery` with `actingRole` and notify the farmer and acceptors.

- [ ] **Step 1: failing tests**

```ts
// test/lab-quality.test.ts
import { PILOT_QUALITY_SPEC } from "@f2f/sdk";
import { describe, expect, it } from "vitest";
import { evaluateLab, parseRequirement } from "../src/lib/lab-quality";

const good = { crop: "Wheat", class: "HiPro (class 3)", gluten: "31", protein: "15.2", moisture: "13.5", falling_number: "250", test_weight: "760", impurities: "1.5", odour: "None", gluten_deformation_index: "70", vitreousness: "55", pests: "None" };

describe("lab quality", () => {
  it("parses the twelve pilot requirements", () => {
    expect(parseRequirement("≥ 30%")).toEqual({ op: "min", value: 30, unit: "%" });
    expect(parseRequirement("≤ 2%")).toEqual({ op: "max", value: 2, unit: "%" });
    expect(parseRequirement("14% (12%)")).toEqual({ op: "max", value: 14, unit: "%" });
    expect(parseRequirement("≥ 750 g/l")).toEqual({ op: "min", value: 750, unit: "g/l" });
    expect(parseRequirement("None")).toEqual({ op: "text", expected: "none" });
  });
  it("passes a protocol inside the spec", () => {
    const r = evaluateLab(PILOT_QUALITY_SPEC, good);
    expect(r.verdict).toBe("Pass");
    expect(r.results.every((x) => x.pass)).toBe(true);
  });
  it("fails one parameter out of spec, case-insensitive text", () => {
    const r = evaluateLab(PILOT_QUALITY_SPEC, { ...good, protein: "14.9", odour: "none" });
    expect(r.verdict).toBe("Fail");
    expect(r.results.find((x) => x.key === "protein")?.pass).toBe(false);
    expect(r.results.find((x) => x.key === "odour")?.pass).toBe(true);
  });
  it("missing measurements are insufficient data", () => {
    const { gluten: _, ...rest } = good;
    expect(evaluateLab(PILOT_QUALITY_SPEC, rest).verdict).toBe("InsufficientData");
    expect(evaluateLab(PILOT_QUALITY_SPEC, { ...good, gluten: "abc" }).verdict).toBe("InsufficientData");
  });
});
```

`workflow-delivery.test.ts`: elevator records a receipt (fake chain call with kind ElevatorReceipt, evidence in a `MemoryStore` contains `receiptNumberSha256` and not the receipt number, audit `actingRole: "elevator"`); a lab user cannot record a receipt (403) and an elevator user cannot record a lab protocol; lab protocol with one failing parameter records verdict Fail; arranger can record both.
- [ ] **Step 2:** FAIL. **Step 3:** implement. Cabinet `/elevator`: guard allows `elevator`, `lab`, arranger; lists Funded term-sheet pools with delivery possible (`settlementMode !== "CashBuyback"` and election not Buyback); receipt form shown to elevator (and arranger), lab form with 12 inputs (requirement shown as hint, live pass/fail per row computed client-side with `evaluateLab`, verdict summary) shown to lab (and arranger). **Step 4:** PASS. **Step 5:** commit `feat(web): elevator and lab cabinet with receipt and 12-parameter lab protocol`.

### Task 7: Regulator cabinet and CSV export

**Files:** Create `src/lib/csv.ts`, `src/lib/workflow/regulator.ts`, `app/regulator/{layout,page}.tsx`, `app/regulator/pools/[poolId]/page.tsx`, `app/regulator/events/page.tsx`, `app/api/regulator/export/route.ts`, `test/workflow-regulator.test.ts`, `test/routes/regulator-export.test.ts`. Modify `src/lib/chain/reader.ts` (`holders(mint): Promise<{ wallet: string; balance: string }[]>` via `getProgramAccounts(TOKEN_2022, memcmp mint at 0)`), `src/lib/statement.ts` (reuse `csvCell` from `csv.ts`).

**Interfaces:**
- `toCsv(header: string[], rows: (string | number | null)[][]): string` (quotes, doubles quotes, neutralises leading `=+-@` with a `'` prefix).
- `registryRows(db, pools: PoolView[])` → `{ poolId, symbol, status, issuerWallet, issuerLegalName, issuerBin, raisedUsd, targetUsd, couponBps, maturity, holders }` (issuer data joined by `farmer_profiles.kyc_wallet = pool.issuer`).
- `holderRows(db, poolHolders: { poolId; wallet; balance }[])` → `{ poolId, wallet, balance, category, iin }` (category and IIN from the wallet's investor profile; never email or name).
- `eventRows(db, { poolId?, limit })` → `{ at, action, actingRole, targetType, targetId, signature, detail }` where `detail` uses only whitelisted payload keys `["pool","poolId","amount","kind","verdict","election","from","to","rule","project"]`.
- `filterRegistry(rows, { status?, bin?, iin?, poolId? })`.
- Route `GET /api/regulator/export?kind=registry|holders|events&pool=<id>` → `requireServiceAction("regulator")`, CSV with `content-disposition: attachment; filename="f2f-<kind>-<date>.csv"`, `cache-control: no-store`.

- [ ] **Step 1: failing tests**: holders rows carry category and IIN and never contain the email; event rows drop non-whitelisted payload keys (a `farmer_kyc.reject` row with `note: "BIN 123 mismatch"` exports no note); CSV escaping neutralises `=SUM(1)`; route refuses an investor (403), signed out (401) and returns CSV for regulator and arranger.
- [ ] **Step 2:** FAIL. **Step 3:** implement. Cabinet: registry table with filters (status chips, BIN/IIN/pool search via GET form), per-pool page with holders table, events page; export buttons as outline links (no primary on a read-only cabinet except none: the export of the registry is the one wheat action). **Step 4:** PASS. **Step 5:** commit `feat(web): read-only regulator cabinet with registry, holders, events and CSV export`.

### Task 8: Farmer settlement from the web

**Files:** Modify `src/lib/chain/user-tx.ts` (`TX_ACTIONS` + `elect-settlement`, `fund-redemption`), `src/lib/chain/sponsor.ts` (validation), `app/api/tx/[action]/route.ts` (issuer-of-record gate), `app/api/tx/send/route.ts` (`beforeSign` gate for farmer actions), `src/lib/server/tx-history.ts` (notifications), `components/farmer/obligations.tsx`, `app/farmer/page.tsx`; create `components/farmer/settlement-actions.tsx`, tests in `test/user-tx.test.ts`, `test/sponsor.test.ts`, `test/farmer-settlement.test.tsx`.

**Interfaces:**
- Body `elect-settlement`: `{ signer, poolId, election: "Buyback" | "Delivery" }`; `fund-redemption`: `{ signer, poolId, amount }` (base units, > 0).
- `buildUserTx` throws 403 "Only the issuer of record of this pool can …" when `signer !== pool.issuer`.
- Sponsor: `elect_settlement` accounts `signer = wallet`, `config`, `instrumentTerms = PDA(pool)`; `fund_redemption` accounts `issuer = wallet`, `config`, `usdcMint`, `issuerUsdc = usdcAta(wallet)`, `vault` (program checks `pool.vault`), `instrumentTerms = PDA(pool)`, `usdcTokenProgram = TOKEN_PROGRAM`; no rent; summary `{ pool, amount }`.
- `ObligationItem` gains `poolId`, `issuerWallet`, `hybrid`, `electionOpen`, `canElect`, `fundingDeadlineTs` (maturity), `lapseTs` (maturity + 7 days), `election`.
- `SettlementActions({ item })` client: Elect buyback (primary when election open), Elect delivery (outline, confirm), Fund buyback of the shortfall (primary once buyback elected), each through `useTransaction` with the Privy signer; disabled reasons shown.

- [ ] **Step 1: failing tests**: `buildUserTx` for both actions returns one f2f instruction with the farmer as signer and sponsor as payer; refuses a non-issuer signer (403); sponsor accepts built transactions and rejects a `fund_redemption` whose `issuerUsdc` is another wallet's ATA, an `elect_settlement` with a foreign `instrumentTerms`, and any extra instruction; component shows "Elect buyback" before maturity on a Hybrid pool and "Fund buyback" with the shortfall after a buyback election.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** commit `feat(web): farmer elects settlement and funds the buyback from the cabinet`.

### Task 9: Arranger lifecycle board

**Files:** Create `src/lib/lifecycle.ts`, `components/arranger/lifecycle-board.tsx`, `app/arranger/pools/[poolId]/page.tsx`, `app/api/arranger/report/[poolId]/route.ts`, `test/lifecycle.test.ts`, `test/lifecycle-board.test.tsx`. Modify `app/arranger/actions.ts` (`recordSettlementAllAction(poolId)`: record `CashRepaidWithPremium` after maturity or `Delivered` when harvest attested, for every unsettled project; `openRedemptionAction` = `fundRedemption`), `app/arranger/pools/page.tsx` (board summary per pool linking to the pool page; console moves to the pool page).

**Interfaces:**
- `PHASES = ["subscription","funding","season","harvest","settlement","closing"]`.
- `lifecycle(d: PoolDetail, nowSec): Phase[]` where `Phase = { key; label; owner: "investors" | "arranger" | "scas" | "elevator" | "lab" | "farmer" | "chain" | null; state: "done" | "current" | "todo"; next: string; action?: "close_subscription" | "disburse" | "record_settlement" | "open_redemption" | "sweep" }`.
- Rules: Open → subscription current (owner investors; action close_subscription when full or past close). Funded and not all disbursed → funding current (arranger, disburse). Funded, disbursed, before maturity → season current (scas; "Season attestations"); harvest phase current when delivery path needs receipt/lab (elevator/lab) or buyback pending election (farmer). After maturity on the buyback path: unsettled projects → settlement (arranger, record_settlement); vault short → settlement (farmer, "Fund the buyback"); funded and settled → (arranger, open_redemption). Delivery path after maturity with documents → settlement (investors, "Holders claim grain"). Redeeming with supply 0 → closing (arranger, sweep); Redeeming supply > 0 → settlement (investors, "Holders redeem"). Refunding → closing done after refunds (investors).

- [ ] **Step 1: failing tests**: one test per rule above with `PoolDetail` fixtures (`test/fixtures` builders), asserting the current phase, owner and action. Component test: a current arranger phase renders its action button; a phase owned by another role renders the owner name and no button.
- [ ] **Step 2:** FAIL. **Step 3:** implement. Board: horizontal stepper on desktop (6 columns), vertical list on phones; state shown with icon + sr-only text; current phase card below with next action, owner and the button (primary) when the arranger owns it. Final report: CSV (registry row + holders + events of the pool) for arrangers. **Step 4:** PASS. **Step 5:** commit `feat(web): arranger lifecycle board with next action per pool`.

### Task 10: Investor settlement and public season blocks

**Files:** Create `components/investor/grain-claims.tsx`, `components/pool/season-block.tsx`, `src/lib/server/season-data.ts`, `test/grain-claims.test.tsx`, `test/season-block.test.tsx`. Modify `src/lib/server/investor-data.ts` (grain claims from `tx.redeem-delivery` rows: tonnes via `claimableKg`, elevator, lab verdict and results from the evidence JSON), `app/investor/page.tsx` (settlement path card per position: buyback funded / delivery, action link), `app/pools/[poolId]/page.tsx` (season timeline, harvest and quality block, settlement status).

**Interfaces:**
- `seasonData(store, reader, detail)` → `{ attestations: AttestationView[]; receipt: DeliveryEvidence | null; lab: DeliveryEvidence | null }` (evidence read by hash, hash-checked; missing → null).
- `GrainClaim = { id; at; symbol; poolId; tonnes: string; elevator: string; lab: string; labVerdict: string | null; receiptHash: string | null; signature: string | null }`.

- [ ] **Step 1: failing tests**: season block lists attestations by kind with dates and shows "Harvest and quality" only when a receipt or lab record exists, with pass/fail per parameter; grain claims render tonnes, elevator and lab verdict with the explorer link.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** commit `feat(web): investor grain claim certificates, public season and harvest blocks`.

### Task 11: Devnet lifecycle walk

**Files:** Create `src/lib/demo/lifecycle-flow.ts`, `src/lib/demo/lifecycle-flow-env.ts`, `scripts/demo-lifecycle.ts`, `test/lifecycle-flow.test.ts`.

**Interfaces:** `runLifecycleFlow(deps: LifecycleFlowDeps, log, stamp)` using the workflow modules: sign in arranger, compliance, scas, elevator, lab, regulator (granted by the arranger), farmer, investor; for each of two applications (Hybrid, short maturity): farmer onboarding and application, compliance KYC, SCAS verification, structuring and publish, investor KYC by compliance, KFD, subscribe (sponsored, investor keypair), close, disburse, SCAS Sowing/Vegetation/Harvest (yield estimate), elevator receipt, lab protocol. Pool A: farmer elects buyback and funds the shortfall (sponsored, farmer keypair; test USDC minted to the farmer for the coupon), wait for maturity, arranger records settlement and opens redemption, investor redeems, arranger sweeps. Pool B: farmer elects delivery, wait for maturity, investor claims grain. Regulator exports registry, holders and events CSV to `docs/devlog/2026-10-05-regulator/*.csv` (fake data only). The test runs the flow against fakes and PGlite and asserts both paths finish and the exports exist.

- [ ] Steps: failing test → implement → PASS → run `DEMO_DATABASE_URL=<local docker postgres> scripts/inf.sh pnpm exec tsx scripts/demo-lifecycle.ts` → record links in the devlog → commit `feat(demo): devnet walk of both settlement paths with every service cabinet`.

### Task 12: Docs

ADR 0017 "Service role cabinets" (Accepted, user decision 2026-10-05), ADR index; `web.md` (cabinets, routes, RPC retry, notifications), `data.md` (roles, acting role, dedupe key, link, IIN), flows (`compliance-review.md`, `season-and-harvest.md`, `settlement.md`, update `issuance-pipeline.md`, `pool-lifecycle.md`), glossary (Service role, Acting role, Lifecycle board, Lab protocol, Regulator registry), README links, devlog. Commit `docs: service role cabinets, lifecycle flows, ADR 0017`.

### Task 13: Screens

Screenshots desktop and 390px of every new and changed cabinet screen from a worktree dev server on port 3400 with a local Postgres; `screen-critique`, fix P1; `better-interface` review by a fresh subagent; fix blocking items. Commit `fix(web): screen review of the service cabinets`.

### Task 14: Final review and merge

Fresh reviewer on model fable over the branch (focus list in the request); fix Critical and Important with RED→GREEN tests; full suite, `tsc`, `next build`; fast-forward `main`, push, delete the remote branch.

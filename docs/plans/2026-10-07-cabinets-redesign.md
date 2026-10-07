# Cabinets redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is executed inline (executing-plans) in the worktree `feat/cabinets-redesign`.

**Goal:** Replace the post-login role picker and the six role cabinets with three doors (investor sign-up, farmer apply, console by invitation), an investor app, an issuer workspace and one permission-based console, without breaking any existing capability.

**Architecture:** Permissions are code constants; console roles are permission bundles (`src/lib/permissions.ts`); every page, action, route and workflow checks a permission. Roles stay in `user_roles`; one additive migration adds `console_invitations`. Pages move under route groups: `(site)` for public pages and doors, `(app)/invest` and `(app)/issuer` with a top-bar shell, `console` with a left-nav shell. Old URLs redirect through `next.config.ts` from one table in `src/lib/redirects.ts`.

**Tech Stack:** Next.js 16 app router (server components, server actions), Drizzle 0.45 on Postgres (PGlite in tests), Privy email login, Vitest + Testing Library, Tailwind with the Night field tokens.

**Spec:** [docs/specs/2026-10-07-cabinets-redesign.md](../specs/2026-10-07-cabinets-redesign.md), ADR [0018](../architecture/decisions/0018-separate-doors-and-permission-based-console.md).

## Global Constraints

- Work only in `/Users/yesset/Desktop/bonkboykz/f2f-cabinets` (branch `feat/cabinets-redesign`). Dev server only on port 3400 against a local docker Postgres; never Infisical's `DATABASE_URL` (production).
- Migrations additive only; never edit `0000`–`0002`. Generate with `pnpm --filter @f2f/web run db:generate --name console_invitations` from `apps/web`.
- No role name checks in pages, actions, routes or workflows outside `src/lib/permissions.ts` and `src/lib/workflow/team.ts`/`users.ts` (account kinds `farmer`/`investor` are checked with `assertAccount`).
- Style lock `.tastemaker/style-lock.md`: tokens only, no hex in components, no `dark:` variants, one wheat primary action per screen, 390px without horizontal scroll, no em dashes in UI copy.
- Private identifiers never in the repo; demo values only (`Demo Farm LLP`, `@example.com`).
- Each commit message ends with a blank line and `Claude-Session: https://claude.ai/code/session_01ME22MMec3RnxBQUt7ynVd7`.
- Commands from `apps/web`: tests `pnpm exec vitest run [file]`, types `pnpm exec tsc --noEmit`, build `pnpm exec next build` (with `F2F_DEV_AUTH` unset).

## Review Focus

1. A user with a narrow console role (scas, elevator, lab, regulator) calling an action of another section directly (server action id or route): must get 403. Pinned by a table-driven test over every console action module (Task 3).
2. Invitation link opened by a different signed-in email, after expiry, after revocation, or twice (two tabs): must refuse without granting; exactly one accept wins. Pinned in Task 4 tests.
3. Old bookmarks and stored notification links (`/investor/pools/7#invest`, `/arranger/roles?x=1`, `/farmer/applications/new`): must land on the new page with query preserved. Pinned in Task 6.
4. A signed-in investor opening `/apply/start` (other door): must not get a second account kind; sees a clear message and a link home. Pinned in Task 5.
5. Regulator and partners must not see emails, investor names or KYC answers in the console (inbox counts, nav, records). Pinned in Task 8 (inbox data by permission) and existing regulator tests.

---

### Task 1: Permission model

**Files:**
- Create: `apps/web/src/lib/permissions.ts`
- Modify: `apps/web/src/lib/workflow/guards.ts`
- Test: `apps/web/test/permissions.test.ts`

**Interfaces:**
- Produces:
  - `PERMISSIONS` (readonly tuple), `type Permission`
  - `CONSOLE_ROLES = ["arranger","compliance","scas","elevator","lab","regulator"] as const`, `type ConsoleRole`
  - `ROLE_PERMISSIONS: Record<ConsoleRole, readonly Permission[]>`
  - `permissionsOf(roles: readonly Role[]): Set<Permission>`
  - `can(user: { roles: readonly Role[] } | null, p: Permission): boolean`
  - `isConsoleMember(user: { roles: readonly Role[] } | null): boolean`
  - `actingRoleFor(roles: readonly Role[], p: Permission): ConsoleRole | null` (narrowest: any granting role except `arranger` first, in `CONSOLE_ROLES` order after arranger; else `arranger`)
  - `PERMISSION_LABELS: Record<Permission, string>`, `CONSOLE_ROLE_LABELS: Record<ConsoleRole, { name: string; description: string }>`
  - guards: `assertPermission(user: SessionUser, p: Permission): { user: SessionUser; permission: Permission; actingRole: ConsoleRole }` throwing `RequestError(403, "You do not have permission to <PERMISSION_VERB[p]>.")`; `assertAccount(user, kind: "farmer" | "investor")` (replaces `assertRole` for account kinds).

- [ ] **Step 1: failing test** `test/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { actingRoleFor, can, CONSOLE_ROLES, isConsoleMember, PERMISSIONS, permissionsOf, ROLE_PERMISSIONS } from "../src/lib/permissions";
import { assertPermission } from "../src/lib/workflow/guards";

const MATRIX: Record<string, string[]> = {
  arranger: [...PERMISSIONS],
  compliance: ["issuers.view", "investors.view", "kyc.decide", "kyc.revoke"],
  scas: ["verification.attest"],
  elevator: ["delivery.receipt"],
  lab: ["delivery.lab"],
  regulator: ["registry.view", "registry.export"],
};

describe("permission matrix", () => {
  it("is pinned", () => {
    for (const r of CONSOLE_ROLES) expect([...ROLE_PERMISSIONS[r]].sort()).toEqual([...MATRIX[r]!].sort());
  });
  it("unions roles and ignores account kinds", () => {
    expect([...permissionsOf(["scas", "lab", "investor"])].sort()).toEqual(["delivery.lab", "verification.attest"]);
    expect(permissionsOf(["farmer", "investor"]).size).toBe(0);
    expect(isConsoleMember({ roles: ["investor"] })).toBe(false);
    expect(isConsoleMember({ roles: ["regulator"] })).toBe(true);
    expect(can(null, "audit.view")).toBe(false);
  });
  it("picks the narrowest acting role", () => {
    expect(actingRoleFor(["arranger", "scas"], "verification.attest")).toBe("scas");
    expect(actingRoleFor(["arranger"], "delivery.lab")).toBe("arranger");
    expect(actingRoleFor(["regulator"], "kyc.decide")).toBeNull();
  });
  it("assertPermission refuses with 403 and returns the acting role", () => {
    const u = { id: "1", email: "s@example.com", roles: ["scas" as const] };
    expect(assertPermission(u, "verification.attest").actingRole).toBe("scas");
    expect(() => assertPermission(u, "kyc.decide")).toThrow(expect.objectContaining({ status: 403 }));
  });
});
```

- [ ] **Step 2:** run `pnpm exec vitest run test/permissions.test.ts` → FAIL (module missing).
- [ ] **Step 3:** implement `permissions.ts` with the matrix of spec §5.3 and the verbs (`"review applications"`, `"decide KYC"`, ...); add `assertPermission`, `assertAccount` to `guards.ts`.
- [ ] **Step 4:** test passes.
- [ ] **Step 5:** commit `feat(web): permission model with console role bundles`.

### Task 2: Workflows check permissions

**Files:**
- Modify: `src/lib/workflow/{arranger,compliance,scas,delivery,users,farmer,investor}.ts`, `src/lib/workflow/guards.ts` (remove `assertServiceRole`, `assertRole`)
- Test: update `test/service-roles.test.ts`, `test/workflow-*.test.ts` expectations of messages; add `test/workflow-permissions.test.ts`

**Interfaces:**
- Consumes: `assertPermission`, `assertAccount` (Task 1).
- Mapping (function → permission): `reviewDocument`, `advanceApplication`, `rejectApplication` → `applications.review`; `structureApplication`, `publishApplication` → `pools.structure`; `decideFarmerKyc`, `decideInvestorKyc` → `kyc.decide`; `revokeInvestor` → `kyc.revoke`; `verifyApplicationFields`, `recordSeasonAttestation` → `verification.attest`; `recordElevatorReceipt` → `delivery.receipt`; `recordLabProtocol` → `delivery.lab`; `grantRoleByEmail` removed (Task 4 replaces it), `revokeRole` → `team.manage`. `acting_role` written from `assertPermission(...).actingRole` wherever `assertServiceRole(...).role` was used.

- [ ] **Step 1: failing test** `test/workflow-permissions.test.ts`: for each workflow function above, a PGlite user holding only an unrelated console role (e.g. `regulator`) gets `{ status: 403 }`; a `scas` user verifying fields audits `acting_role = "scas"`, an arranger doing the same audits `"arranger"`.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** replace the checks; `farmer.ts`/`investor.ts` use `assertAccount`.
- [ ] **Step 4:** `pnpm exec vitest run test/workflow-*.test.ts test/service-roles.test.ts test/workflow-permissions.test.ts` → PASS (update expected messages from "does not have the X role" to the permission sentence).
- [ ] **Step 5:** commit `refactor(web): workflows authorize by permission`.

### Task 3: Server guards, console actions and routes

**Files:**
- Modify: `src/lib/server/auth.ts` (add `requirePermission(p)`, `consoleAccess(path)`, `requireAccount(kind)`; `currentUser` wrapped in React `cache`; remove `requireRole`, `requireAnyRole`, `requireServiceAction`, `requireActionRole`)
- Create: `src/lib/action-result.ts` (`ActionResult` type moved here), `src/lib/server/console-action.ts` (`consoleAction(p, message, fn)`, `actionError`, `signaturesSince`, `storeUpload`, replacing `service-action.ts`)
- Move (git mv): `src/app/arranger/actions.ts` → `src/app/console/_actions/pools.ts`; `src/app/arranger/workflow-actions.ts` → `src/app/console/_actions/applications.ts`; `src/app/compliance/actions.ts` → `src/app/console/_actions/kyc.ts`; `src/app/scas/actions.ts` → `src/app/console/_actions/verification.ts`; `src/app/elevator/actions.ts` → `src/app/console/_actions/delivery.ts`; `src/app/farmer/actions.ts` → `src/app/(app)/issuer/actions.ts`; `src/app/investor/actions.ts` → `src/app/(app)/invest/actions.ts`
- Modify: every importer listed by `grep -rn "app/arranger/actions\|workflow-actions\|app/elevator/actions\|app/scas/actions\|app/farmer/actions\|app/investor/actions" src test`
- Modify routes: `api/regulator/export` (`registry.export`), `api/arranger/report/[poolId]` (`pools.view`), `api/documents/[hash]` (`documents.view`, else `issuers.view` and kind `kyc`, else uploader), `api/investor/statement` (`requireAccount("investor")`)
- Test: `test/console-actions-authz.test.ts` (new), update `test/{arranger-actions,arranger-workflow-actions,compliance-actions,scas-actions,elevator-actions,farmer-actions,investor-actions,server-auth}.test.ts` mocks and paths

**Interfaces:**
- Produces: `requirePermission(p: Permission): Promise<{ user: SessionUser; actingRole: ConsoleRole }>` (401 signed out, 403 missing); `consoleAccess(path): Promise<{ user: SessionUser; permissions: Set<Permission> }>` (redirects signed-out to `/sign-in?next=`); `consoleAction(p, message, fn: (user, db, actingRole) => Promise<unknown>): Promise<ActionResult>`; pool console `run(meta, fn)` keeps its audit row and calls `requirePermission(meta.permission)`; each pool action declares its permission (`pools.structure` for create pool, onboarding tools, field import; `pools.operate` for lifecycle; `verification.attest` for verify all / attest stage; `kyc.decide` approve wallet; `kyc.revoke` revoke; `settings.manage` fees and mint).

- [ ] **Step 1: failing test** `test/console-actions-authz.test.ts`: mock `@/lib/server/auth` `currentUser` to return a user with only `regulator`; import every exported async function of the five `_actions` modules, call each with dummy args, expect `{ ok: false, error: { title: /permission/ } }` and that no workflow/chain mock was called. A second case with `scas` succeeds only for verification actions' guard (the workflow mock is called).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement guards, move files, fix imports; actions use `consoleAction`.
- [ ] **Step 4:** full suite `pnpm exec vitest run` and `pnpm exec tsc --noEmit` green.
- [ ] **Step 5:** commit `refactor(web): console actions and routes guarded by permission`.

### Task 4: Console invitations and team management

**Files:**
- Modify: `src/lib/db/schema.ts` (table `consoleInvitations`), generate `drizzle/0003_console_invitations.sql` + meta
- Create: `src/lib/workflow/team.ts`
- Modify: `src/lib/workflow/users.ts` (drop `grantRoleByEmail`, `chooseRole` moves to Task 5)
- Test: `test/team.test.ts`, update `test/db-schema.test.ts`

**Interfaces:**
- Produces:
  - `createInvitation(db, actor, { email, roles: ConsoleRole[] }, now = new Date()): Promise<{ id: string; token: string; expiresAt: Date }>` (`team.manage`; revokes the email's open invitation; token `randomBytes(32).toString("base64url")`; stores `sha256hex(token)`; 7 days)
  - `inspectInvitation(db, token, now?): Promise<{ state: "valid" | "expired" | "revoked" | "used" | "invalid"; roles?: ConsoleRole[]; maskedEmail?: string; expiresAt?: Date }>`
  - `acceptInvitation(db, user: SessionUser, token, now?): Promise<ConsoleRole[]>` (transaction, `for update`, email match, inserts roles with `granted_by = invited_by`, audit `team.invitation.accept`, notifies inviter)
  - `revokeInvitation(db, actor, id)`, `listInvitations(db)` (open ones), `listMembers(db)` (users with console roles), `setMemberRoles(db, actor, userId, roles: ConsoleRole[], arrangerEmails)` (diff; last-arranger and own-arranger and ARRANGER_EMAILS rules as `revokeRole`), `maskEmail(email)`
- [ ] **Step 1: failing tests** in `test/team.test.ts`: only the hash is stored (`token_hash !== token`, length 64); re-invite revokes the previous; non-`team.manage` actor 403; accept with other email 403 and no role; expired → refuses; revoked → refuses; second accept refuses (`used`); two concurrent `acceptInvitation` calls → exactly one resolves; accept grants every role and audits; `inspectInvitation` of a random token → `invalid`; `setMemberRoles` cannot remove the last arranger; `maskEmail("alice@example.com") === "a***@example.com"`.
- [ ] **Step 2:** run → FAIL. **Step 3:** schema + migration + workflow. **Step 4:** PASS + `test/db-schema.test.ts`. **Step 5:** commit `feat(web): console invitations and team management`.

### Task 5: Doors and home routing

**Files:**
- Create: `src/lib/workflow/accounts.ts` (`openAccount(db, user, door: "investor" | "issuer")`), `src/lib/auth/home.ts` (`homeFor(roles): string | null`)
- Modify: `src/lib/auth/redirects.ts` (`cabinetFor` removed, use `homeFor`), `src/lib/roles.ts` (drop `ROLE_CABINET`, `ROLE_PRIORITY`), `src/app/api/session/route.ts` (add `GET` returning `{ signedIn, home }`, no-store; POST returns `home`), `src/components/auth/privy-auth.tsx` (`server.home`)
- Test: `test/accounts.test.ts`, `test/home.test.ts`, update `test/auth-session.test.ts`, `test/workflow-users.test.ts`
- [ ] **Step 1: failing tests:** `openAccount` investor twice returns the same roles (idempotent) and one audit `account.open`; investor then issuer → 409 "This email already has an investor account"; profile created; `homeFor(["regulator","investor"]) === "/console"`, `homeFor(["farmer"]) === "/issuer"`, `homeFor(["investor"]) === "/invest"`, `homeFor([]) === null`; `GET /api/session` without cookie → `{ signedIn: false }`.
- [ ] **Step 2–4** as usual. **Step 5:** commit `feat(web): door accounts and home routing`.

### Task 6: Redirects and the sign-in gate

**Files:**
- Create: `src/lib/redirects.ts` (`LEGACY_REDIRECTS: { source: string; destination: string }[]` in Next syntax, `resolveLegacy(path): string | null` for tests and the 404 fallback)
- Modify: `next.config.ts` (`redirects: async () => LEGACY_REDIRECTS.map((r) => ({ ...r, permanent: false }))`), `src/lib/cabinet-redirect.ts` (gate `/console`, `/issuer`, `/invest` except `/invest/signup`), delete `src/app/admin/page.tsx`, `src/app/portfolio/page.tsx`
- Test: `test/redirects.test.ts`, update `test/cabinet-redirect.test.ts`
- [ ] **Step 1: failing test:** every row of spec §3.3 via `resolveLegacy` (`/arranger/roles` → `/console/team`, `/investor/pools/7` → `/invest/pools/7`, `/farmer/applications/new` → `/issuer/applications/new`, `/compliance/limits` → `/console/investors/limits`, `/admin` → `/console`, `/portfolio` → `/invest`); `next.config` redirects equal the table with `permanent: false`; the gate sends `/console/team` without cookie to `/sign-in?next=%2Fconsole%2Fteam`, leaves `/invest/signup` and `/apply/start` alone.
- [ ] **Step 2–4.** **Step 5:** commit `feat(web): redirects from the old cabinet URLs`.

### Task 7: Shells, route groups and the public header

Load `ui-design`, `emil-design-eng`, `better-layout` before this task.

**Files:**
- Modify: `src/app/layout.tsx` (html/body/SkipLink/WalletProviders only)
- Create: `src/app/(site)/layout.tsx` (SiteHeader + main + SiteFooter); git mv `src/app/{page.tsx,pools,fields,sign-in}` into `(site)`; `src/app/not-found.tsx` renders the site header itself
- Create: `src/components/shell/app-header.tsx` (logo, tabs, bell, account menu), `src/components/shell/account-menu.tsx` (email, other apps from `homeLinks(roles)`, sign out), `src/components/shell/page-header.tsx` (`title`, `description?`, `action?`)
- Create: `src/app/(app)/invest/layout.tsx`, `src/app/(app)/issuer/layout.tsx` (AuthProvider + AppHeader + main + footer)
- Modify: `src/components/site-header.tsx` (Pools, Get financing, Sign in, primary Start investing; "Open app" when `GET /api/session` says signed in)
- Test: `test/site-header.test.tsx`, `test/app-header.test.tsx`
- [ ] **Step 1: failing tests:** site header has no Investor/Farmer/Arranger links, has "Start investing" → `/invest/signup`, "Get financing" → `/apply`; app header marks the active tab and lists other apps only when held.
- [ ] **Step 2–4.** **Step 5:** commit `feat(web): public header and app shells`.

### Task 8: Console shell, inbox and sections

**Files:**
- Create: `src/app/console/layout.tsx` (AuthProvider + `ConsoleShell`), `src/components/console/{console-shell.tsx,console-nav.tsx,nav-items.ts,inbox.tsx,guard.tsx}`, `src/lib/server/inbox-data.ts` (`inboxQueues(db, permissions)`), `src/app/console/page.tsx` (Inbox)
- Move (git mv) pages: `arranger/page.tsx` → `console/applications/page.tsx`; `arranger/applications/[id]` → `console/applications/[id]`; `arranger/pools` → `console/pools`; `arranger/audit` → `console/audit`; `arranger/treasury` → `console/settings`; `compliance/page.tsx` → `console/issuers/page.tsx`; `compliance/investors` → `console/investors` (merging `arranger/investors`); `compliance/limits` → `console/investors/limits`; `scas` → `console/verification`; `elevator` → `console/delivery`; `regulator` → `console/registry`; new `console/settlement/page.tsx`
- Modify: each moved page: `guardConsole(permission, path)` instead of `guardCabinet`/`guardServiceCabinet`, `PageHeader` instead of `CabinetShell`, internal links to new paths, buttons rendered only with the permission (`can(...)`).
- Delete: `components/{arranger,compliance,regulator,scas,farmer,investor}/tabs.ts`, `components/cabinet/{cabinet-shell,cabinet-nav,guard,no-access}.tsx` once unused (replace `no-access` with `components/console/forbidden.tsx`)
- Test: `test/console-nav.test.tsx`, `test/inbox-data.test.ts`, `test/console-guard.test.tsx`; update the old cabinet component tests' paths
- **Interfaces:** `guardConsole(p: Permission | Permission[] | null, path): Promise<{ user; permissions: Set<Permission> } | { element }>` (array = any of); `CONSOLE_NAV: { href; label; icon; permission: Permission | Permission[] | null }[]`; `inboxQueues(db, perms): Promise<Queue[]>` with `Queue = { key; title; href; count; items: { id; label; sub; href }[] }` (labels never include emails for queues visible to partners; KYC queues only with `kyc.decide`).
- [ ] **Step 1: failing tests:** nav for `["regulator"]` shows exactly Inbox and Registry; for `["elevator","lab"]` Inbox and Delivery; for arranger all twelve; `inboxQueues` with `verification.attest` only returns just the fields queue; guard: no console role → forbidden element pointing to the user's home; missing permission → forbidden inside shell; Postgres down → error state.
- [ ] **Step 2–4.** **Step 5:** commits per section group: `feat(web): console shell and inbox`, `feat(web): console sections replace the service cabinets`.

### Task 9: Team page and invitation acceptance

**Files:**
- Create: `src/app/console/team/page.tsx` (members, open invitations, invite form, permission matrix), `src/app/console/_actions/team.ts` (`inviteAction`, `revokeInvitationAction`, `setMemberRolesAction`), `src/components/console/{invite-form.tsx,member-roles.tsx,permission-matrix.tsx}`
- Create: `src/app/(site)/invite/[token]/page.tsx` (metadata `referrer: "no-referrer"`, `robots: noindex`, dynamic), `src/app/(site)/invite/[token]/accept.tsx` (client: sign in, accept), `src/app/(site)/invite/[token]/actions.ts` (`acceptInvitationAction(token)`)
- Delete: `src/app/arranger/roles`, `components/arranger/role-form.tsx`
- Test: `test/team-page.test.tsx` (invite form shows the link once with copy and expiry; matrix renders 18 rows), `test/invite-accept.test.tsx` (states: invalid, expired, wrong email message, accept success navigates to `/console`)
- [ ] Steps 1–5; commit `feat(web): team page and invitation acceptance`.

### Task 10: Investor app

**Files:**
- Move: `src/app/investor/pools/[poolId]` → `src/app/(app)/invest/pools/[poolId]`; `investor/onboarding` → `(app)/invest/account`
- Create: `(app)/invest/page.tsx` (Overview), `(app)/invest/portfolio/page.tsx`, `(app)/invest/activity/page.tsx`, `(app)/invest/opportunities/page.tsx`, `src/components/invest/tabs.ts`, `src/lib/invest-summary.ts` (`summarize(portfolio, now)` → `{ atMaturity, accrued, usdc, next: { ts, amount } | null, upcoming }`)
- Create: `(site)/invest/signup/page.tsx` with `DoorSignup door="investor"` (`src/components/doors/door-signup.tsx`, `src/app/(site)/doors-actions.ts` `openAccountAction(door)`)
- Modify: links `/investor/...` in `components/investor/positions.tsx`, `components/pool/invest-panel.tsx`, `components/wallet/connect-button.tsx`, workflow notification links (`arranger.ts`, `notifications.ts`, `tx-history.ts`) to `/invest/...`
- Test: `test/invest-summary.test.ts`, `test/door-signup.test.tsx` (opens account after sign-in then routes to `/invest/account`; other-door 409 message with link home), update `test/investor-cabinet.test.tsx`
- [ ] Steps 1–5; commit `feat(web): investor app and sign-up door`.

### Task 11: Issuer workspace and the apply door

**Files:**
- Move: `src/app/farmer/**` → `src/app/(app)/issuer/**` (`onboarding` → `company`)
- Create: `(app)/issuer/obligations/page.tsx` (obligations + payouts moved from the overview), `src/lib/issuer-next-action.ts` (`nextAction(profileComplete, kyc, latestApp)` → `{ title; owner; href; label }`), `(site)/apply/page.tsx` (what we finance, `FARMER_REQUIREMENTS` checklist, steps, "Start application" → `/apply/start`), `(site)/apply/start/page.tsx` (`DoorSignup door="issuer"`)
- Modify: farmer components links to `/issuer/...`; workflow links `/farmer` → `/issuer`; landing `/farmer` link → `/apply`
- Test: `test/issuer-next-action.test.ts`, update `test/farmer-cabinet.test.tsx`
- [ ] Steps 1–5; commit `feat(web): issuer workspace and the apply door`.

### Task 12: Sign-in without a role picker

**Files:**
- Modify: `src/app/(site)/sign-in/page.tsx`, `sign-in-panel.tsx` (no choices; after session → `home` or the no-account state with both doors and "Use another email"), delete `sign-in/actions.ts`
- Test: rewrite `test/sign-in-panel.test.tsx`: no "I am a farmer" anywhere; roles → `router.replace(home)`; no account → links to `/invest/signup` and `/apply`.
- [ ] Steps 1–5; commit `feat(web): sign-in routes home, no role picker`.

### Task 13: Docs, screenshots, critique, reviews

- [ ] Update `docs/systems/web.md` (routes table, sign-in, console, permissions), `docs/systems/data.md` (`console_invitations`), flows (`farmer-onboarding`, `investor-onboarding`, `compliance-review`, `issuance-pipeline`, `season-and-harvest`, `settlement`: paths), `docs/glossary.md` (Console, Permission, Door, Invitation; Cabinet → historical), `.tastemaker/style-lock.md` (console left nav), `docs/devlog/2026-10-07.md`.
- [ ] Local docker Postgres, migrations, `F2F_DEV_AUTH=1` dev server on 3400; seed demo users (`scripts` dev token `dev:<email>`); screenshots desktop 1440 and 390 of: landing header, sign-in, `/invest/signup`, `/apply`, `/invest`, `/invest/portfolio`, `/issuer`, `/console` as arranger, as scas, as regulator, `/console/team`, `/invite/<token>`; before shots from `main` built separately on port 3401 with the same database. Save to `docs/research/cabinets-ux/screens/f2f-before/` and `f2f-after/`.
- [ ] `screen-critique` on the after shots; fix P1s; fresh subagent `better-interface` review; fix.
- [ ] `tsc`, full suite, `next build`; final review by a fresh `fable` subagent; fix Critical/Important with tests; fast-forward merge to `main`, push; bump the parent submodule pointer.

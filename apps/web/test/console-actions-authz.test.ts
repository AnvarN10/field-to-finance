import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivyPort } from "../src/lib/auth/session";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

// Every console server action, called by users whose roles do not grant its permission, must refuse before any
// workflow, store or chain call. The real guards run (session cookie → Privy → Postgres roles → permission).
const db = await testDb();
await makeUser(db, "reg@example.com", ["regulator"]);
await makeUser(db, "scas@example.com", ["scas"]);
await makeUser(db, "inv@example.com", ["investor"]);
const privy: PrivyPort = {
  async verify(token) {
    return { did: `did:privy:${token}`, expiresAt: 4_000_000_000 };
  },
  async profile() {
    return { email: null, solanaWallets: [] };
  },
};
let cookie: string | undefined;
const touched = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookie ? { value: cookie } : undefined) }) }));
vi.mock("next/navigation", () => ({ redirect: (u: string) => { throw new Error(`NEXT_REDIRECT ${u}`); } }));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/privy", () => ({ getPrivy: () => privy }));
vi.mock("@/lib/server/status-refresh", () => ({ refreshStatuses: async () => 0 }));
vi.mock("@/lib/server/env", () => ({ serverEnv: () => ({ PUBLIC_BASE_URL: "http://localhost:3000", ARRANGER_EMAILS: "" }) }));
const trap = () => new Proxy({}, { get: () => { touched(); throw new Error("touched a dependency before authorization"); } });
vi.mock("@/lib/server/context", () => ({ opsContext: trap, getReader: trap, getStore: trap, stubDeps: trap, invalidateReads: () => {} }));
vi.mock("@/lib/server/chain-port", () => ({ arrangerChain: trap }));

const MODULES = {
  pools: await import("../src/app/console/_actions/pools"),
  applications: await import("../src/app/console/_actions/applications"),
  kyc: await import("../src/app/console/_actions/kyc"),
  verification: await import("../src/app/console/_actions/verification"),
  delivery: await import("../src/app/console/_actions/delivery"),
};

const form = () => {
  const f = new FormData();
  f.set("kind", "Sowing");
  return f;
};
const ARGS = ["7", form(), "00000000-0000-4000-8000-000000000000"];
const call = (fn: unknown) => (fn as (...a: unknown[]) => Promise<unknown>)(...ARGS);
const all = Object.entries(MODULES).flatMap(([m, mod]) => Object.entries(mod).filter(([, v]) => typeof v === "function").map(([k, v]) => [`${m}.${k}`, v] as const));
const refused = (r: unknown) => {
  const x = r as { ok: boolean; error?: string | { title: string } };
  const msg = typeof x.error === "string" ? x.error : x.error?.title;
  return x.ok === false && /permission|session expired/i.test(msg ?? "");
};

beforeEach(() => touched.mockClear());

describe("console actions refuse users without the permission", () => {
  it("covers every exported action", () => {
    expect(all.length).toBeGreaterThanOrEqual(25);
  });

  it.each(all)("%s refuses a regulator", async (_n, fn) => {
    cookie = "reg@example.com";
    expect(refused(await call(fn))).toBe(true);
    expect(touched).not.toHaveBeenCalled();
  });

  it.each(all)("%s refuses an investor", async (_n, fn) => {
    cookie = "inv@example.com";
    expect(refused(await call(fn))).toBe(true);
    expect(touched).not.toHaveBeenCalled();
  });

  it.each(all)("%s refuses a signed-out caller", async (_n, fn) => {
    cookie = undefined;
    expect(refused(await call(fn))).toBe(true);
  });

  it("lets an SCAS partner past the guard of the verification actions only", async () => {
    cookie = "scas@example.com";
    for (const [name, fn] of all) {
      const r = await call(fn);
      const scasAllowed = name.startsWith("verification.") || name === "pools.verifyAllFieldsAction" || name === "pools.attestStageAction";
      expect([name, refused(r)]).toEqual([name, !scasAllowed]);
    }
  });
});

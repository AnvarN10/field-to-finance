import { describe, expect, it } from "vitest";
import { toCsv } from "../src/lib/csv";
import { farmerProfiles, investorProfiles, wallets } from "../src/lib/db/schema";
import { audit } from "../src/lib/workflow/audit";
import { eventRows, filterRegistry, holderRows, registryRows } from "../src/lib/workflow/regulator";
import { testDb } from "./helpers/db";
import { poolView, terms } from "./helpers/pool";
import { FARMER_WALLET, INVESTOR_WALLET, makeUser } from "./helpers/workflow";

const db = await testDb();
const farmer = await makeUser(db, "farmer@example.com", ["farmer"], FARMER_WALLET);
const inv = await makeUser(db, "secret-investor@example.com", ["investor"], INVESTOR_WALLET);
await db.insert(farmerProfiles).values({ userId: farmer.id, legalName: "Demo Farm LLP", bin: "000000000000", kycStatus: "approved", kycWallet: FARMER_WALLET });
await db.insert(investorProfiles).values({ userId: inv.id, category: "retail", kycStatus: "approved", questionnaire: { kyc: { fullName: "Hidden Name", country: "Other", iin: "000000000001" } } });
await audit(db, { actorUserId: farmer.id, actingRole: null, action: "farmer_kyc.reject", targetType: "user", targetId: farmer.id, payload: { note: "BIN 123456789012 does not match the charter", poolId: "9" } });
await audit(db, { actorUserId: inv.id, action: "tx.subscribe", targetType: "wallet", targetId: INVESTOR_WALLET, payload: { pool: "PoolA", amount: "100000000", email: "secret-investor@example.com" }, signatures: ["sig-sub"] });

describe("regulator registry", () => {
  it("joins the issuer's legal name and BIN to each pool through the KYC wallet", async () => {
    const rows = await registryRows(db, [poolView({ terms: terms() })], new Map([["9", 3]]));
    expect(rows[0]).toMatchObject({ poolId: "9", symbol: "DWHT27", status: "Funded", issuerWallet: FARMER_WALLET, issuerLegalName: "Demo Farm LLP", issuerBin: "000000000000", couponBps: 1200, holders: 3 });
  });

  it("a pool whose holders could not be read shows an unknown count, not zero", async () => {
    const rows = await registryRows(db, [poolView({ terms: terms() })], new Map());
    expect(rows[0]?.holders).toBeNull();
  });

  it("holders carry category and IIN, never email or name", async () => {
    const rows = await holderRows(db, [{ poolId: "9", wallet: INVESTOR_WALLET, balance: "100000000" }, { poolId: "9", wallet: "Unlinked1111111111111111111111111111111111", balance: "5" }]);
    expect(rows).toEqual([
      { poolId: "9", wallet: INVESTOR_WALLET, balance: "100000000", category: "retail", iin: "000000000001" },
      { poolId: "9", wallet: "Unlinked1111111111111111111111111111111111", balance: "5", category: null, iin: null },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/secret-investor|Hidden Name/);
  });

  it("events keep only whitelisted payload keys", async () => {
    const rows = await eventRows(db, {});
    const json = JSON.stringify(rows);
    expect(json).not.toMatch(/does not match the charter|secret-investor/);
    expect(rows.find((r) => r.action === "tx.subscribe")).toMatchObject({ signature: "sig-sub", detail: "amount=100000000; pool=PoolA" });
  });

  it("filters by status, pool, BIN and IIN", async () => {
    const rows = await registryRows(db, [poolView({ terms: terms() }), poolView({ poolId: "10", address: "Other111111111111111111111111111111111111111", issuer: "NoKyc1111111111111111111111111111111111111", status: "Open" })], new Map());
    expect(filterRegistry(rows, { status: "Open" }).map((r) => r.poolId)).toEqual(["10"]);
    expect(filterRegistry(rows, { bin: "000000000000" }).map((r) => r.poolId)).toEqual(["9"]);
    expect(filterRegistry(rows, { poolId: "10" }).map((r) => r.poolId)).toEqual(["10"]);
    expect(filterRegistry(rows, { iin: "000000000001", holdersByIin: new Map([["000000000001", new Set(["9"])]]) }).map((r) => r.poolId)).toEqual(["9"]);
  });
});

describe("toCsv", () => {
  it("quotes, doubles quotes and neutralises formulas", () => {
    expect(toCsv(["a", "b"], [["=SUM(1)", 'x "y", z'], [null, 3]])).toBe('a,b\r\n\'=SUM(1),"x ""y"", z"\r\n,3\r\n');
  });
});

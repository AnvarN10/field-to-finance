import { describe, expect, it } from "vitest";
import { investorProfiles, kfdAcceptances } from "../src/lib/db/schema";
import { listNotifications, markAllRead, maturityReminders, notify, notifyApprovedInvestors, notifyOnce, notifyPoolInvestors, unreadCount } from "../src/lib/workflow/notifications";
import { testDb } from "./helpers/db";
import { makeUser } from "./helpers/workflow";

const db = await testDb();
const a = await makeUser(db, "a@example.com", ["investor"]);
const b = await makeUser(db, "b@example.com", ["investor"]);
const farmer = await makeUser(db, "f@example.com", ["farmer"]);
await db.insert(investorProfiles).values([
  { userId: a.id, kycStatus: "approved" },
  { userId: b.id, kycStatus: "pending" },
]);
await db.insert(kfdAcceptances).values({ investorUserId: a.id, poolAddress: "PoolA", documentHash: "0".repeat(64) });

describe("notifications", () => {
  it("keeps the in-app link", async () => {
    await notify(db, b.id, "x", "Linked", "Body", "/investor/pools/1");
    expect((await listNotifications(db, b.id))[0]).toMatchObject({ title: "Linked", link: "/investor/pools/1" });
  });

  it("notifyOnce writes one row per key", async () => {
    expect(await notifyOnce(db, a.id, "k1", "x", "T", "B")).toBe(true);
    expect(await notifyOnce(db, a.id, "k1", "x", "T", "B")).toBe(false);
    expect((await listNotifications(db, a.id)).filter((n) => n.title === "T")).toHaveLength(1);
  });

  it("pool fan-out reaches KFD acceptors; approved fan-out reaches approved investors only", async () => {
    await notifyPoolInvestors(db, "PoolA", "pool", "Election made", "Buyback");
    await notifyApprovedInvestors(db, "pool", "Pool opened", "New pool");
    expect((await listNotifications(db, a.id)).map((n) => n.title)).toEqual(expect.arrayContaining(["Election made", "Pool opened"]));
    expect((await listNotifications(db, b.id)).map((n) => n.title)).toEqual(["Linked"]);
  });

  it("maturity reminder: once, only inside 7 days, to holders and the farmer", async () => {
    const now = 1_000_000;
    const pools = [
      { address: "PoolA", poolId: "1", symbol: "F2F1", maturityTs: now + 3 * 86_400 },
      { address: "PoolB", poolId: "2", symbol: "F2F2", maturityTs: now + 30 * 86_400 },
      { address: "PoolC", poolId: "3", symbol: "F2F3", maturityTs: now - 10 },
    ];
    const farmers = new Map([["PoolA", farmer.id], ["PoolB", farmer.id], ["PoolC", farmer.id]]);
    await maturityReminders(db, pools, now, farmers);
    await maturityReminders(db, pools, now, farmers);
    expect((await listNotifications(db, farmer.id)).filter((n) => n.kind === "maturity")).toHaveLength(1);
    expect((await listNotifications(db, a.id)).filter((n) => n.kind === "maturity")).toHaveLength(1);
  });

  it("unread count and mark all read", async () => {
    expect(await unreadCount(db, a.id)).toBeGreaterThan(0);
    await markAllRead(db, a.id);
    expect(await unreadCount(db, a.id)).toBe(0);
    expect(await unreadCount(db, b.id)).toBeGreaterThan(0);
  });
});

describe("user transaction history", () => {
  it("records the transaction and tells the wallet's owner", async () => {
    const { recordUserTransaction } = await import("../src/lib/workflow/tx-history");
    const { wallets } = await import("../src/lib/db/schema");
    await db.insert(wallets).values({ address: "WalletB", userId: b.id, kind: "phantom" });
    await recordUserTransaction(db, { action: "subscribe", wallet: "WalletB", signature: "sig-sub", pool: "PoolA", project: null, amount: "100000000" }, { poolId: "1", symbol: "F2F1" });
    await recordUserTransaction(db, { action: "redeem-delivery", wallet: "WalletB", signature: "sig-claim", pool: "PoolA", project: null, amount: "1" }, { poolId: "1", symbol: "F2F1" });
    const titles = (await listNotifications(db, b.id)).map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining(["Subscription confirmed: F2F1", "Grain claim recorded: F2F1"]));
  });

  it("a transaction from an unlinked wallet is recorded without a notification", async () => {
    const { recordUserTransaction } = await import("../src/lib/workflow/tx-history");
    await expect(recordUserTransaction(db, { action: "redeem", wallet: "Nobody", signature: "sig-x", pool: "PoolA", project: null, amount: "1" }, null)).resolves.toBeUndefined();
  });
});

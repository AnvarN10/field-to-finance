import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { applications, userRoles, users, wallets } from "../src/lib/db/schema";
import { testDb } from "./helpers/db";

describe("schema", () => {
  it("applies migrations, defaults an application to draft and keeps roles per user", async () => {
    const db = await testDb();
    const [u] = await db.insert(users).values({ email: "demo+farmer@example.com", privyDid: "did:privy:1" }).returning();
    await db.insert(userRoles).values({ userId: u!.id, role: "farmer" });
    const [a] = await db
      .insert(applications)
      .values({ farmerUserId: u!.id, crop: "wheat", grade: "3", volumeT: 1000, tokenizedShareBps: 3000, requestedUsd: 100000, proposedCouponBps: 1200, season: 2027, elevator: "Demo elevator", lab: "Demo lab" })
      .returning();
    expect(a!.status).toBe("draft");
    expect((await db.select().from(userRoles).where(eq(userRoles.userId, u!.id))).map((r) => r.role)).toEqual(["farmer"]);
  });

  it("refuses a duplicate email, an unknown role and a wallet linked twice", async () => {
    const db = await testDb();
    const [u] = await db.insert(users).values({ email: "a@example.com" }).returning();
    const [v] = await db.insert(users).values({ email: "b@example.com" }).returning();
    await expect(db.insert(users).values({ email: "a@example.com" })).rejects.toThrow();
    await expect(db.insert(userRoles).values({ userId: u!.id, role: "root" as never })).rejects.toThrow();
    await db.insert(wallets).values({ address: "Wallet1111111111111111111111111111", userId: u!.id, kind: "phantom" });
    await expect(db.insert(wallets).values({ address: "Wallet1111111111111111111111111111", userId: v!.id, kind: "phantom" })).rejects.toThrow();
  });
});

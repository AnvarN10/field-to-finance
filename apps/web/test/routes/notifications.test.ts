import { describe, expect, it, vi } from "vitest";
import { notify } from "../../src/lib/workflow/notifications";
import { testDb } from "../helpers/db";
import { makeUser } from "../helpers/workflow";

const db = await testDb();
const me = await makeUser(db, "me@example.com", ["investor"]);
const other = await makeUser(db, "other@example.com", ["investor"]);
await notify(db, me.id, "kyc", "KYC approved", "Body");
await notify(db, other.id, "kyc", "Someone else's", "Body");
let user: unknown = me;
vi.mock("@/lib/server/auth", () => ({ currentUser: async () => user }));
vi.mock("@/lib/server/db", () => ({ getDb: async () => db }));
vi.mock("@/lib/server/reminders", () => ({ remindMaturities: async () => {} }));
const route = await import("../../src/app/api/notifications/route");

describe("/api/notifications", () => {
  it("answers 401 without a session", async () => {
    user = null;
    expect((await route.GET()).status).toBe(401);
    user = me;
  });

  it("returns only the caller's notifications with the unread count", async () => {
    const body = await (await route.GET()).json();
    expect(body).toMatchObject({ ok: true, unread: 1 });
    expect(body.items.map((n: { title: string }) => n.title)).toEqual(["KYC approved"]);
  });

  it("refuses a cross-site mark-read and marks the caller's rows read otherwise", async () => {
    const cross = await route.POST(new Request("http://x/api/notifications", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }));
    expect(cross.status).toBe(403);
    expect((await route.POST(new Request("http://x/api/notifications", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }))).status).toBe(200);
    expect((await (await route.GET()).json()).unread).toBe(0);
    user = other;
    expect((await (await route.GET()).json()).unread).toBe(1);
  });
});

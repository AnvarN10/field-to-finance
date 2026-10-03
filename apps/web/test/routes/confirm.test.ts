import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidateReads = vi.fn();
const confirmOrThrow = vi.fn();
vi.mock("@/lib/server/context", () => ({ getConnection: () => ({}), invalidateReads }));
vi.mock("@/lib/chain/send", async (orig) => ({ ...(await orig<typeof import("../../src/lib/chain/send")>()), confirmOrThrow: (...a: unknown[]) => confirmOrThrow(...a) }));
const { POST } = await import("../../src/app/api/tx/confirm/route");

const body = { signature: "5".repeat(88), blockhash: "B".repeat(43), lastValidBlockHeight: 0 };
const req = () => new Request("http://x/api/tx/confirm", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  invalidateReads.mockClear();
  confirmOrThrow.mockReset();
});

describe("POST /api/tx/confirm", () => {
  it("clears the read cache after a confirmed transaction", async () => {
    confirmOrThrow.mockResolvedValue(undefined);
    expect((await POST(req())).status).toBe(200);
    expect(invalidateReads).toHaveBeenCalledOnce();
  });

  it("keeps the cache for a signature that does not confirm, so junk requests cannot defeat it", async () => {
    confirmOrThrow.mockRejectedValue(new Error("block height exceeded"));
    expect((await POST(req())).status).toBe(422);
    expect(invalidateReads).not.toHaveBeenCalled();
  });
});

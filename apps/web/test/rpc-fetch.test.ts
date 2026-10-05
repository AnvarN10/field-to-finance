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

  it("honours Retry-After seconds", async () => {
    const inner = vi.fn().mockResolvedValueOnce(res(429, { "retry-after": "2" })).mockResolvedValueOnce(res(200));
    const sleeps: number[] = [];
    await retryingFetch(inner as unknown as typeof fetch, { sleep: async (ms) => void sleeps.push(ms) })("https://rpc");
    expect(sleeps).toEqual([2000]);
  });

  it("caps a long Retry-After", async () => {
    const inner = vi.fn().mockResolvedValueOnce(res(429, { "retry-after": "600" })).mockResolvedValueOnce(res(200));
    const sleeps: number[] = [];
    await retryingFetch(inner as unknown as typeof fetch, { maxMs: 5_000, sleep: async (ms) => void sleeps.push(ms) })("https://rpc");
    expect(sleeps).toEqual([5_000]);
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

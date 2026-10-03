import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "../src/lib/ttl-cache";

describe("createTtlCache", () => {
  it("reuses a value within the TTL and dedupes in-flight loads", async () => {
    let t = 0;
    const cache = createTtlCache(5_000, () => t);
    const load = vi.fn(async () => 42);
    await Promise.all([cache.get("a", load), cache.get("a", load)]);
    expect(load).toHaveBeenCalledTimes(1);
    t = 4_999;
    await cache.get("a", load);
    expect(load).toHaveBeenCalledTimes(1);
    t = 5_000;
    await cache.get("a", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures and can be cleared", async () => {
    const cache = createTtlCache(5_000, () => 0);
    await expect(cache.get("x", async () => Promise.reject(new Error("rpc down")))).rejects.toThrow("rpc down");
    expect(await cache.get("x", async () => 1)).toBe(1);
    cache.clear();
    expect(await cache.get("x", async () => 2)).toBe(2);
  });
});

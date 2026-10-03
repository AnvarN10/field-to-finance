import { describe, expect, it } from "vitest";
import { clientIp, createRateLimit } from "../src/lib/rate-limit";

describe("createRateLimit", () => {
  it("allows `limit` actions per window per key, then says how long to wait", () => {
    let t = 0;
    const rl = createRateLimit({ limit: 2, windowMs: 60_000, now: () => t });
    expect(rl.take("a")).toBe(0);
    expect(rl.take("a")).toBe(0);
    expect(rl.take("a")).toBe(60);
    expect(rl.take("b")).toBe(0);
    t = 30_000;
    expect(rl.take("a")).toBe(30);
    t = 60_001;
    expect(rl.take("a")).toBe(0);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop (Railway's proxy), else a shared bucket", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

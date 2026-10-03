import { describe, expect, it, vi } from "vitest";
import { SentinelError } from "../src/errors";
import { CDSE_STATS_URL, CDSE_TOKEN_URL, SentinelClient } from "../src/sentinel/client";
import { buildStatsRequest } from "../src/sentinel/request";
import { SQUARE } from "./helpers";

const REQUEST = buildStatsRequest(SQUARE, { from: "2026-09-01T00:00:00Z", to: "2026-10-01T00:00:00Z" });

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function fakeFetch(statsResponses: (() => Response)[]) {
  const calls = { token: 0, stats: 0, bodies: [] as string[] };
  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === CDSE_TOKEN_URL) {
      calls.token += 1;
      calls.bodies.push(String(init?.body));
      return json({ access_token: `token-${calls.token}`, expires_in: 600 });
    }
    expect(url).toBe(CDSE_STATS_URL);
    const next = statsResponses[Math.min(calls.stats, statsResponses.length - 1)];
    calls.stats += 1;
    if (!next) throw new Error("no stats response configured");
    return next();
  };
  return { fetch: fn as typeof fetch, calls };
}

const ok = () => json({ data: [], status: "OK" });

describe("SentinelClient", () => {
  it("requests a client-credentials token once and reuses it", async () => {
    const { fetch, calls } = fakeFetch([ok]);
    const client = new SentinelClient({ clientId: "id", clientSecret: "s3cret", fetch, sleep: vi.fn() });
    await client.fetchStats(REQUEST);
    await client.fetchStats(REQUEST);
    expect(calls.token).toBe(1);
    expect(calls.stats).toBe(2);
    expect(calls.bodies[0]).toBe("grant_type=client_credentials&client_id=id&client_secret=s3cret");
  });

  it("refreshes the token after it expires", async () => {
    const { fetch, calls } = fakeFetch([ok]);
    let now = 0;
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, now: () => now, sleep: vi.fn() });
    await client.fetchStats(REQUEST);
    now = 541_000; // past 600 s minus the 60 s margin
    await client.fetchStats(REQUEST);
    expect(calls.token).toBe(2);
  });

  it("retries a 500 with backoff and then succeeds", async () => {
    const { fetch, calls } = fakeFetch([() => json({ error: "boom" }, 500), ok]);
    const sleep = vi.fn(async (_ms: number) => {});
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep });
    await expect(client.fetchStats(REQUEST)).resolves.toEqual({ data: [], status: "OK" });
    expect(calls.stats).toBe(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it("honors Retry-After on 429", async () => {
    const { fetch } = fakeFetch([() => json({}, 429, { "retry-after": "2" }), ok]);
    const sleep = vi.fn(async (_ms: number) => {});
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep });
    await client.fetchStats(REQUEST);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("gives up after 4 attempts with a SentinelError", async () => {
    const { fetch, calls } = fakeFetch([() => json({ error: "down" }, 503)]);
    const sleep = vi.fn(async (_ms: number) => {});
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep });
    await expect(client.fetchStats(REQUEST)).rejects.toBeInstanceOf(SentinelError);
    expect(calls.stats).toBe(4);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000, 2000]);
  });

  it("does not retry a 400", async () => {
    const { fetch, calls } = fakeFetch([() => json({ error: { message: "bad evalscript" } }, 400)]);
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn() });
    await expect(client.fetchStats(REQUEST)).rejects.toThrow(/returned 400/);
    expect(calls.stats).toBe(1);
  });

  it("drops the token and retries on 401", async () => {
    const { fetch, calls } = fakeFetch([() => json({}, 401), ok]);
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn(async () => {}) });
    await client.fetchStats(REQUEST);
    expect(calls.token).toBe(2);
  });

  it("treats network errors as retryable", async () => {
    let first = true;
    const { fetch: inner } = fakeFetch([ok]);
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === CDSE_STATS_URL && first) {
        first = false;
        throw new TypeError("fetch failed");
      }
      return inner(input, init);
    }) as typeof globalThis.fetch;
    const client = new SentinelClient({ clientId: "id", clientSecret: "s", fetch, sleep: vi.fn(async () => {}) });
    await expect(client.fetchStats(REQUEST)).resolves.toBeTruthy();
  });
});

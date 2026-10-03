export interface RateLimit {
  /** Records one action for `key`; returns 0 when allowed, else the seconds until the next slot frees. */
  take(key: string): number;
}

/** Sliding-window limiter, in process (resets on restart, which is fine for a demo). */
export function createRateLimit({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }): RateLimit {
  const hits = new Map<string, number[]>();
  return {
    take(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return Math.ceil(((recent[0] as number) + windowMs - t) / 1000);
      }
      recent.push(t);
      hits.set(key, recent);
      return 0;
    },
  };
}

/** Railway's proxy puts the client first in x-forwarded-for. Requests without it share one bucket. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Checks every limiter in order and returns the wait in seconds of the first that refuses, else 0. */
export function takeAll(pairs: [RateLimit, string][]): number {
  for (const [rl, key] of pairs) {
    const wait = rl.take(key);
    if (wait > 0) return wait;
  }
  return 0;
}

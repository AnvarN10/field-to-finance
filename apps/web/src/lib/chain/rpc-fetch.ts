export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const RETRY = new Set([429, 502, 503, 504]);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The public devnet RPC answers 429 under load. Retries with exponential backoff and jitter, honouring Retry-After
 * (capped at `maxMs`), then returns the last response so the caller sees the real status.
 */
export function retryingFetch(inner: typeof fetch = fetch, o: RetryOptions = {}): typeof fetch {
  const retries = o.retries ?? 4;
  const base = o.baseMs ?? 400;
  const max = o.maxMs ?? 8_000;
  const sleep = o.sleep ?? wait;
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    for (let attempt = 0; ; attempt++) {
      const res = await inner(input, init);
      if (!RETRY.has(res.status) || attempt >= retries) return res;
      const after = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(after) && after > 0 ? after * 1000 : base * 2 ** attempt + Math.floor(Math.random() * base * 0.25);
      await res.body?.cancel().catch(() => {});
      await sleep(Math.min(backoff, max));
    }
  }) as typeof fetch;
}

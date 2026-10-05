export interface TtlCache {
  get<T>(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

export interface TtlCacheOptions {
  /** Keys whose failed reload resolves with the last good value (kept across clear()). */
  staleOnError?: (key: string) => boolean;
}

/** In-process read cache. Devnet's public RPC rate-limits getProgramAccounts, so pages share results for a few seconds. */
export function createTtlCache(ttlMs: number, now: () => number = Date.now, opts: TtlCacheOptions = {}): TtlCache {
  const entries = new Map<string, { at: number; value: Promise<unknown> }>();
  const good = new Map<string, unknown>();
  return {
    get<T>(key: string, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value as Promise<T>;
      const stale = opts.staleOnError?.(key) ?? false;
      const value: Promise<T> = load().then(
        (v) => {
          if (stale) good.set(key, v);
          return v;
        },
        (e: unknown) => {
          // A stale answer keeps its entry, so the TTL also spaces out retries against a rate-limited RPC.
          if (stale && good.has(key)) return good.get(key) as T;
          if (entries.get(key)?.value === value) entries.delete(key);
          throw e;
        },
      );
      entries.set(key, { at: now(), value });
      return value;
    },
    clear() {
      entries.clear();
    },
  };
}

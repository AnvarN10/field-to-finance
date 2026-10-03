export interface TtlCache {
  get<T>(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

/** In-process read cache. Devnet's public RPC rate-limits getProgramAccounts, so pages share results for a few seconds. */
export function createTtlCache(ttlMs: number, now: () => number = Date.now): TtlCache {
  const entries = new Map<string, { at: number; value: Promise<unknown> }>();
  return {
    get<T>(key: string, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value as Promise<T>;
      const value = load();
      entries.set(key, { at: now(), value });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      return value;
    },
    clear() {
      entries.clear();
    },
  };
}

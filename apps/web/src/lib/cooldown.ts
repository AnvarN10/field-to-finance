export interface Cooldown {
  /** Seconds left before `key` may act again; 0 when allowed. */
  remaining(key: string): number;
  mark(key: string): void;
}

export function createCooldown(ms: number, now: () => number = Date.now): Cooldown {
  const last = new Map<string, number>();
  return {
    remaining(key) {
      const at = last.get(key);
      if (at === undefined) return 0;
      const left = at + ms - now();
      return left > 0 ? Math.ceil(left / 1000) : 0;
    },
    mark(key) {
      last.set(key, now());
    },
  };
}

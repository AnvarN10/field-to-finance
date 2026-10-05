/** At most one run per window; `force` runs anyway and restarts the window. */
export function createThrottle(windowMs: number, now: () => number = Date.now) {
  let last = -Infinity;
  return {
    take(force = false): boolean {
      const t = now();
      if (!force && t - last < windowMs) return false;
      last = t;
      return true;
    },
  };
}

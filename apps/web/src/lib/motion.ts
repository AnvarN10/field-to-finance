import { formatUsd } from "./format";

/** Style-lock Motion: number tickers run 900ms. */
export const TICKER_MS = 900;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the viewer asked for reduced motion. False on the server and where matchMedia is missing. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Cubic ease-out, the closest polynomial to the style-lock --ease-out curve. Clamped to [0, 1]. */
export function easeOutCubic(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  return 1 - (1 - p) ** 3;
}

/**
 * One frame of a USDC amount counting up from zero. Integer math on base units, so the last frame
 * (progress 1) is exactly formatUsd(value), the same string the server rendered.
 */
export function usdTickerFrame(value: bigint | string, progress: number, opts: { cents?: boolean } = {}): string {
  const target = BigInt(value);
  if (progress >= 1) return formatUsd(target, opts);
  const ppm = BigInt(Math.round(easeOutCubic(progress) * 1_000_000));
  return formatUsd((target * ppm) / 1_000_000n, opts);
}

/**
 * Items of a list stagger in only on their first data load (style-lock: 40ms step, at most 8 items).
 * Returns the CSS delay for item i, capped so long lists finish quickly.
 */
export const STAGGER_STEP_MS = 40;
export const STAGGER_MAX_ITEMS = 8;
export const staggerDelay = (i: number) => `${Math.min(i, STAGGER_MAX_ITEMS - 1) * STAGGER_STEP_MS}ms`;

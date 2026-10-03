"use client";

import { useEffect, useRef } from "react";
import { formatUsd } from "../../lib/format";
import { prefersReducedMotion, TICKER_MS, usdTickerFrame } from "../../lib/motion";

/**
 * A funded amount that counts up from zero once, the first time it scrolls into view (style-lock: 900ms).
 * The server renders the final value, so without JS and with reduced motion the number never moves.
 * Inside a [data-intro] block the count waits for that block's CSS entrance to finish.
 * Screen readers get the final value only; the moving digits are aria-hidden.
 */
export function UsdTicker({ value, cents = true }: { value: string; cents?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);
  const final = formatUsd(value, { cents });

  useEffect(() => {
    const el = ref.current;
    if (!el || played.current || BigInt(value) === 0n) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    played.current = true;

    let raf = 0;
    let cancelled = false;
    let started = false;
    el.textContent = usdTickerFrame(value, 0, { cents });

    const count = () => {
      if (cancelled) return;
      started = true;
      const t0 = performance.now();
      const step = (now: number) => {
        const p = (now - t0) / TICKER_MS;
        el.textContent = usdTickerFrame(value, p, { cents });
        if (p < 1 && !cancelled) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const afterIntro = () => {
      const intro = el.closest<HTMLElement>("[data-intro]");
      const running = intro?.getAnimations?.().filter((a) => a.playState === "running" || a.pending) ?? [];
      if (!running.length) return count();
      void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(count);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        afterIntro();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);

    return () => {
      cancelled = true;
      // React strict mode mounts twice: an effect torn down before counting may run again.
      if (!started) played.current = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      el.textContent = final;
    };
  }, [value, cents, final]);

  return (
    <>
      {/* key: frames are written to this node directly, so a new value must get a fresh node React owns. */}
      <span key={final} ref={ref} aria-hidden className="tabular">
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}

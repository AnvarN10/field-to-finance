"use client";

import { useEffect, useState } from "react";
import { STAGGER_MAX_ITEMS, STAGGER_STEP_MS, staggerDelay } from "../lib/motion";

/** Long enough for the last staggered row (8 × 40ms) plus its 220ms entrance. */
export const ENTER_WINDOW_MS = STAGGER_MAX_ITEMS * STAGGER_STEP_MS + 220 + 60;

/**
 * Rows of a client-loaded list enter with a stagger on the first data load only (style-lock Motion).
 * Returns props for row i while that first batch is entering, and nothing afterwards, so rows that
 * appear on a refetch or poll render in place without animating.
 */
export function useEnterOnce(ready: boolean): (i: number) => { className: string; style?: React.CSSProperties } {
  const [phase, setPhase] = useState<"waiting" | "entering" | "done">("waiting");

  useEffect(() => {
    if (!ready || phase !== "waiting") return;
    setPhase("entering");
  }, [ready, phase]);

  useEffect(() => {
    if (phase !== "entering") return;
    const t = setTimeout(() => setPhase("done"), ENTER_WINDOW_MS);
    return () => clearTimeout(t);
  }, [phase]);

  return (i) => (phase === "done" ? { className: "" } : { className: "enter-row", style: { animationDelay: staggerDelay(i) } });
}

import type { TermDefaults } from "../components/arranger/term-builder";

const NOMINALS = [100_000, 50_000, 25_000, 10_000, 5_000, 1_000, 100, 1];

/** Term builder starting values from an application: the largest round nominal that divides the amount into whole tokens. */
export function termDefaults(app: { crop: string; season: number; requestedUsd: number; proposedCouponBps: number }, maxArrangementBps: number | null): TermDefaults {
  const crop = app.crop.charAt(0).toUpperCase() + app.crop.slice(1);
  return {
    name: `${crop} ${app.season} harvest`.slice(0, 32),
    symbol: `${app.crop.slice(0, 3).toUpperCase()}${String(app.season).slice(2)}`.slice(0, 10),
    unitNominalUsd: NOMINALS.find((n) => app.requestedUsd % n === 0) ?? 1,
    couponBps: app.proposedCouponBps,
    settlementMode: "Hybrid",
    closeInMinutes: 120,
    maturityInMinutes: 60 * 24 * 90,
    arrangementFeeBps: Math.min(200, maxArrangementBps ?? 0),
  };
}

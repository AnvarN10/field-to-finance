/** What the investor overview shows (spec §7): value at maturity, accrued coupon, test USDC, next and upcoming payments. */
export type InvestSummary = { atMaturity: bigint; accrued: bigint; usdc: bigint; next: { ts: number; amount: bigint } | null; upcoming: { ts: number; amount: bigint }[] };

type Row = { atMaturity: string; accrued: string | null; maturityTs: number };

export function summarize(p: { positions: Row[]; states: ({ usdcBalance?: string } | null)[] }, now: number): InvestSummary {
  const atMaturity = p.positions.reduce((s, r) => s + BigInt(r.atMaturity), 0n);
  const accrued = p.positions.reduce((s, r) => s + BigInt(r.accrued ?? "0"), 0n);
  const usdc = p.states.reduce((s, x) => s + BigInt(x?.usdcBalance ?? "0"), 0n);
  const byDate = new Map<number, bigint>();
  for (const r of p.positions) if (r.maturityTs > now) byDate.set(r.maturityTs, (byDate.get(r.maturityTs) ?? 0n) + BigInt(r.atMaturity));
  const upcoming = [...byDate].sort((a, b) => a[0] - b[0]).map(([ts, amount]) => ({ ts, amount }));
  return { atMaturity, accrued, usdc, next: upcoming[0] ?? null, upcoming };
}

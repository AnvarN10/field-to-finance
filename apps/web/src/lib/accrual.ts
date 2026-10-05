import { effectiveElection, redemptionDue, withCoupon, type SettlementElectionName } from "@f2f/sdk";
import type { InstrumentTermsView, PoolView } from "./chain/views";
import { settlementStatus } from "./instrument-terms";

const DAY = 86_400;

/** Act/360 coupon accrued on `amount` from interest start to now (whole days, capped at maturity), rounded down like the program. */
export function accruedToDate(amount: bigint, couponBps: number, startTs: number, nowSec: number, maturityTs: number): bigint {
  const end = Math.min(nowSec, maturityTs);
  if (end <= startTs) return 0n;
  const days = Math.floor((end - startTs) / DAY);
  return withCoupon(amount, couponBps, days) - amount;
}

export interface Obligation {
  principal: bigint;
  dueAtMaturity: bigint;
  /** Null for pools without term-sheet terms (flat yield, no daily accrual). */
  accrued: bigint | null;
  maturityTs: number;
  election: SettlementElectionName | null;
  settlementLabel: string | null;
  vaultBalance: bigint;
  buybackShortfall: bigint;
}

/** What the issuer owes holders: principal raised, cash due at maturity, accrual so far, and what the vault still lacks for a buyback. */
export function obligation(
  d: { pool: Pick<PoolView, "raisedAmount" | "yieldBps" | "maturityTs">; terms: InstrumentTermsView | null | undefined },
  vaultBalance: bigint,
  nowSec: number,
): Obligation {
  const principal = BigInt(d.pool.raisedAmount);
  const terms = d.terms ?? null;
  const dueAtMaturity = redemptionDue(principal, { yieldBps: d.pool.yieldBps, maturityTs: d.pool.maturityTs }, terms);
  const shortfall = dueAtMaturity > vaultBalance ? dueAtMaturity - vaultBalance : 0n;
  return {
    principal,
    dueAtMaturity,
    accrued: terms ? accruedToDate(principal, terms.couponBpsAnnual, terms.startTs, nowSec, d.pool.maturityTs) : null,
    maturityTs: d.pool.maturityTs,
    election: terms ? effectiveElection(terms, nowSec, d.pool.maturityTs) : null,
    settlementLabel: terms ? settlementStatus(d.pool, terms, nowSec).label : null,
    vaultBalance,
    buybackShortfall: shortfall,
  };
}

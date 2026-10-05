import { canonicalJson, sha256, toHex } from "@f2f/sdk";
import type { PoolDetail } from "./chain/views";
import { formatDateUtc, formatTonnes, formatUsd, formatYield, shortKey } from "./format";
import { couponLabel, instrumentTypeLabel, tokenizedKgOf } from "./instrument-terms";

/**
 * Key features document (KFD) an investor accepts per pool before the first subscription. Built only from the pool's
 * fixed terms (never from amounts raised), so its SHA-256 changes exactly when the terms the investor agreed to change.
 */
export interface Kfd {
  version: 1;
  pool: string;
  poolId: string;
  title: string;
  items: { label: string; value: string }[];
  risks: string[];
}

const RISKS = [
  "Harvest risk: weather, pests or a poor season can reduce the volume or quality of the grain behind the token.",
  "Issuer risk: the farmer company is the issuer of record. If it cannot buy the token back, holders receive grain at the elevator instead of cash.",
  "Liquidity risk: there is no secondary market on the platform; plan to hold the token to maturity.",
  "Technology risk: tokens live on Solana. A lost wallet key means lost tokens; this pilot runs on devnet with test USDC.",
  "Verification risk: field checks come from a satellite verification stub while the external provider is integrated.",
];

export function buildKfd(d: Pick<PoolDetail, "pool" | "terms" | "arrangementFeeBps">, networkFee: string | null): Kfd {
  const p = d.pool;
  const t = d.terms ?? null;
  const symbol = p.instrument?.symbol ?? `POOL-${p.poolId}`;
  const items: { label: string; value: string }[] = [
    { label: "Issuer of record", value: `Farmer company, wallet ${shortKey(p.issuer)}` },
    { label: "Instrument", value: t ? instrumentTypeLabel(t.settlementMode) : "Pooled harvest instrument with a fixed yield" },
  ];
  if (t) {
    items.push(
      { label: "Nominal per token", value: formatUsd(t.unitNominal) },
      { label: "Issue size", value: `${BigInt(p.targetAmount) / BigInt(t.unitNominal)} tokens, ${formatUsd(p.targetAmount)}` },
      { label: "Coupon", value: couponLabel(t) },
      { label: "Grain behind the token", value: `${formatTonnes(tokenizedKgOf(t))} at ${t.elevator}, quality certified by ${t.lab}` },
    );
  } else {
    items.push({ label: "Issue size", value: formatUsd(p.targetAmount) }, { label: "Return", value: `Fixed yield ${formatYield(p.yieldBps)} at maturity` });
  }
  items.push(
    { label: "Subscription closes", value: formatDateUtc(p.subscriptionCloseTs) },
    { label: "Maturity", value: formatDateUtc(p.maturityTs) },
    {
      label: "Settlement",
      value: t
        ? t.settlementMode === "Hybrid"
          ? "The issuer may buy the token back for principal plus coupon; without a funded buyback, holders claim grain pro rata."
          : instrumentTypeLabel(t.settlementMode)
        : "Principal plus the fixed yield in USDC after maturity.",
    },
    {
      label: "Fees",
      value: `${networkFee !== null ? `Network fee ${formatUsd(networkFee)} per subscription. ` : ""}Arrangement fee ${formatYield(d.arrangementFeeBps)}, paid by the farmer from the proceeds.`,
    },
  );
  return { version: 1, pool: p.address, poolId: p.poolId, title: `Key features: ${symbol}`, items, risks: RISKS };
}

export const kfdHash = (k: Kfd): string => toHex(sha256(new TextEncoder().encode(canonicalJson(k))));

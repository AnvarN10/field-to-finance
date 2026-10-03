export const POOL_STATUSES = ["Draft", "Open", "Funded", "Refunding", "Redeeming"] as const;
export type PoolStatusName = (typeof POOL_STATUSES)[number];

export const SETTLEMENT_RULES = ["Delivered", "CoveredFromOtherFields", "BoughtOnMarket", "CashRepaidWithPremium"] as const;
export type SettlementRuleName = (typeof SETTLEMENT_RULES)[number];

/** ADR 0006 Shortfall rules in plain words. */
export const SETTLEMENT_LABELS: Record<SettlementRuleName, string> = {
  Delivered: "Delivered in full",
  CoveredFromOtherFields: "Volume shortfall covered from the Producer's other fields",
  BoughtOnMarket: "Quality shortfall covered by buying grain of the contracted class",
  CashRepaidWithPremium: "Repaid in USD with the fixed premium",
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function fromAnchor<T extends string>(value: unknown, names: readonly T[]): T {
  if (!value || typeof value !== "object") throw new TypeError("not an Anchor enum value");
  const variant = Object.keys(value)[0];
  const match = names.find((n) => lowerFirst(n) === variant);
  if (!match) throw new TypeError(`unknown enum variant: ${String(variant)}`);
  return match;
}

export const poolStatusFromAnchor = (v: unknown): PoolStatusName => fromAnchor(v, POOL_STATUSES);
export const settlementFromAnchor = (v: unknown): SettlementRuleName => fromAnchor(v, SETTLEMENT_RULES);

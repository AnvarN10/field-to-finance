"use client";

import { useState } from "react";
import { recordSettlementAction } from "../../app/arranger/actions";
import { SETTLEMENT_LABELS, SETTLEMENT_RULES, type SettlementRuleName } from "../../lib/chain/enums";
import { ActionButton } from "./action-button";

export function SettlementForm({ poolId, project, disabledReason }: { poolId: string; project: string; disabledReason?: string }) {
  const [rule, setRule] = useState<SettlementRuleName>("CoveredFromOtherFields");
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Shortfall rule
      <select value={rule} onChange={(e) => setRule(e.target.value as SettlementRuleName)} className="h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-base font-normal md:text-sm">
        {SETTLEMENT_RULES.map((r) => (
          <option key={r} value={r}>
            {SETTLEMENT_LABELS[r]}
          </option>
        ))}
      </select>
      </label>
      <ActionButton label="Record settlement" role="Issuer" action={() => recordSettlementAction(poolId, project, rule)} disabled={Boolean(disabledReason)} disabledReason={disabledReason} />
    </div>
  );
}

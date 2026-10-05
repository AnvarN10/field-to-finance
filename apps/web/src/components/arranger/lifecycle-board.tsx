import { CircleCheck, CircleDashed, CircleDot } from "lucide-react";
import { closeSubscriptionAction, disburseAllAction, fundRedemptionAction, openPoolAction, recordSettlementAllAction, sweepAction } from "../../app/arranger/actions";
import type { ArrangerStep, Phase, PhaseOwner } from "../../lib/lifecycle";
import { ActionButton } from "../admin/action-button";

const OWNER: Record<NonNullable<PhaseOwner>, string> = {
  investors: "Investors",
  arranger: "Arranger (you)",
  scas: "SCAS partner",
  elevator: "Elevator",
  lab: "Laboratory",
  farmer: "Farmer issuer",
  chain: "Waiting for maturity",
};

const STATE_TEXT = { done: "Done", current: "Current", todo: "Upcoming" } as const;

function stepAction(poolId: string, step: ArrangerStep) {
  switch (step) {
    case "open_pool":
      return { action: openPoolAction.bind(null, poolId), role: "Issuer" as const };
    case "close_subscription":
      return { action: closeSubscriptionAction.bind(null, poolId), role: "Anyone" as const };
    case "disburse":
      return { action: disburseAllAction.bind(null, poolId), role: "Issuer" as const };
    case "record_settlement":
      return { action: recordSettlementAllAction.bind(null, poolId), role: "Issuer" as const };
    case "open_redemption":
      return { action: fundRedemptionAction.bind(null, poolId), role: "Issuer" as const };
    case "sweep":
      return { action: sweepAction.bind(null, poolId), role: "Issuer" as const, confirmText: "Return the vault remainder to the platform and close the pool?" };
  }
}

/** A pool's phases with the current step, who owns it, and the arranger's button when the step is theirs. */
export function LifecycleBoard({ poolId, phases }: { poolId: string; phases: Phase[] }) {
  const current = phases.find((p) => p.state === "current");
  const a = current?.action ? stepAction(poolId, current.action) : null;
  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="Pool lifecycle" className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {phases.map((p) => {
          const Icon = p.state === "done" ? CircleCheck : p.state === "current" ? CircleDot : CircleDashed;
          return (
            <li key={p.key} className={`flex items-center gap-2 border-t-2 pt-2 text-sm ${p.state === "current" ? "border-primary font-medium text-foreground" : p.state === "done" ? "border-success/60 text-foreground" : "border-border text-muted-foreground"}`}>
              <Icon aria-hidden strokeWidth={1.5} className={`size-4 shrink-0 ${p.state === "done" ? "text-success" : p.state === "current" ? "text-primary" : ""}`} />
              <span className="min-w-0">{p.label}</span>
              <span className="sr-only">{STATE_TEXT[p.state]}</span>
            </li>
          );
        })}
      </ol>
      {current ? (
        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-medium">{a ? "Your step" : current.next}</p>
            {current.owner && !a ? <span className="text-xs text-muted-foreground">{OWNER[current.owner]}</span> : null}
          </div>
          {a ? <ActionButton label={current.next} role={a.role} action={a.action} confirmText={"confirmText" in a ? a.confirmText : undefined} /> : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Every phase is complete.</p>
      )}
    </div>
  );
}

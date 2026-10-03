import { CircleCheck, CircleDashed, CircleDot, RotateCcw, Wallet, type LucideIcon } from "lucide-react";
import type { PoolStatusName } from "../lib/chain/enums";

const STYLE: Record<PoolStatusName, { label: string; className: string; Icon: LucideIcon }> = {
  Draft: { label: "Draft", className: "border-border bg-muted text-muted-foreground", Icon: CircleDashed },
  Open: { label: "Open for subscription", className: "border-primary bg-primary text-gold", Icon: CircleDot },
  Funded: { label: "Funded", className: "border-success text-success", Icon: CircleCheck },
  Refunding: { label: "Refunding", className: "border-warning text-warning", Icon: RotateCcw },
  Redeeming: { label: "Redeeming", className: "border-info text-info", Icon: Wallet },
};

export function PoolStatusBadge({ status }: { status: PoolStatusName }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      <s.Icon aria-hidden strokeWidth={1.5} className="size-3.5" />
      {s.label}
    </span>
  );
}

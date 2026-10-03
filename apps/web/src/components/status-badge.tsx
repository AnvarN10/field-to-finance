import { CircleCheck, CircleDashed, CircleDot, RotateCcw, Wallet, type LucideIcon } from "lucide-react";
import type { PoolStatusName } from "../lib/chain/enums";

const STYLE: Record<PoolStatusName, { label: string; className: string; Icon: LucideIcon }> = {
  // Tints are 12% of the status colour over the surface; every text/tint pair measures >= 5.4:1 (style-lock Color contract).
  Draft: { label: "Draft", className: "border-border text-muted-foreground", Icon: CircleDashed },
  Open: { label: "Open for subscription", className: "border-success/40 bg-success/12 text-success", Icon: CircleDot },
  Funded: { label: "Funded", className: "border-success/40 text-success", Icon: CircleCheck },
  Refunding: { label: "Refunding", className: "border-warning/40 bg-warning/12 text-warning", Icon: RotateCcw },
  Redeeming: { label: "Redeeming", className: "border-info/40 bg-info/12 text-info", Icon: Wallet },
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

import { ScrollText } from "lucide-react";
import { formatDateUtc, formatTonnes } from "../../lib/format";
import { ExplorerLink } from "../explorer-link";

export type GrainClaim = {
  id: string;
  at: Date;
  symbol: string;
  poolId: string;
  /** Kilograms the burned tokens claim, as redeem_delivery computes them. */
  kg: string;
  elevator: string;
  lab: string;
  labPassed: boolean;
  receiptHash: string | null;
  signature: string | null;
};

/** Grain Claim certificates: what was claimed, where it is stored, and the lab result it rests on. */
export function GrainClaims({ claims, cluster }: { claims: GrainClaim[]; cluster: string }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {claims.map((c) => (
        <li key={c.id} aria-labelledby={`claim-${c.id}`} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <ScrollText aria-hidden strokeWidth={1.5} className="size-4 text-muted-foreground" />
            <h3 id={`claim-${c.id}`} className="text-base font-semibold">{`Grain Claim ${c.symbol}`}</h3>
          </div>
          <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Grain</dt>
            <dd className="text-xl font-semibold text-primary">{formatTonnes(c.kg)}</dd>
            <dt className="text-muted-foreground">Elevator</dt>
            <dd>{c.elevator}</dd>
            <dt className="text-muted-foreground">Laboratory</dt>
            <dd>{c.lab}</dd>
            <dt className="text-muted-foreground">Lab result</dt>
            <dd className={c.labPassed ? "text-success" : "text-destructive"}>{c.labPassed ? "Passed" : "Did not pass"}</dd>
            <dt className="text-muted-foreground">Claimed</dt>
            <dd>{formatDateUtc(Math.floor(c.at.getTime() / 1000))}</dd>
          </dl>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {c.signature ? <ExplorerLink kind="tx" value={c.signature} cluster={cluster} /> : null}
            {c.receiptHash ? (
              <a href={`/api/evidence/${c.receiptHash}`} className="rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current">
                Elevator receipt record
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

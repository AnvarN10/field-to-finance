import { CircleCheck, CircleDashed } from "lucide-react";
import type { AttestationView } from "../../lib/chain/views";
import { formatDateUtc } from "../../lib/format";
import { ExplorerLink } from "../explorer-link";
import { ScasStubBadge } from "../scas-stub-badge";

export const STAGES = ["FieldVerified", "Sowing", "Vegetation", "Harvest"] as const;
const LABEL: Record<(typeof STAGES)[number], string> = {
  FieldVerified: "Field verified",
  Sowing: "Sowing",
  Vegetation: "Vegetation",
  Harvest: "Harvest",
};

export function AttestationTimeline({ attestations, cluster = "devnet" }: { attestations: AttestationView[]; cluster?: string }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Attestations</h2>
        <ScasStubBadge />
      </div>
      <ol className="flex flex-col">
        {STAGES.map((stage) => {
          const all = attestations.filter((a) => a.kind === stage).sort((a, b) => b.sequence - a.sequence);
          const latest = all[0];
          return (
            <li key={stage} className="flex min-h-11 items-start gap-3 border-b border-border py-3 last:border-0">
              {latest ? (
                <CircleCheck aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 text-success" />
              ) : (
                <CircleDashed aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 text-muted-foreground" />
              )}
              <div className="flex flex-1 flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{LABEL[stage]}</span>
                  {latest ? <span className="rounded-full border border-success px-2 text-xs text-success">{latest.verdict}</span> : null}
                </div>
                {latest ? (
                  <div className="tabular flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                    <span>{formatDateUtc(latest.recordedAt)}</span>
                    {all.length > 1 ? <span>{all.length} attestations</span> : null}
                    <ExplorerLink kind="address" value={latest.address} cluster={cluster} />
                    <a href={latest.evidenceUri} target="_blank" rel="noreferrer" className="rounded-sm underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-foreground">
                      Evidence JSON
                    </a>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not yet attested</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

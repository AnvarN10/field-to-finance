import { CircleCheck, CircleDashed, CircleDot } from "lucide-react";
import type { AttestationView } from "../../lib/chain/views";
import { formatDateUtc } from "../../lib/format";
import { ExplorerLink } from "../explorer-link";

const STAGES = [
  { kind: "FieldVerified", label: "Field verification" },
  { kind: "Sowing", label: "Sowing" },
  { kind: "Vegetation", label: "Vegetation" },
  { kind: "Harvest", label: "Yield estimate and harvest" },
] as const;

/** The season by stage across every field of a pool: how many fields carry the attestation, when, and its evidence. */
export function SeasonTimeline({ attestations, fieldCount, cluster }: { attestations: AttestationView[]; fieldCount: number; cluster: string }) {
  return (
    <ol className="flex flex-col rounded-lg border border-border bg-card">
      {STAGES.map((s) => {
        const all = attestations.filter((a) => a.kind === s.kind);
        const fields = new Set(all.map((a) => a.field)).size;
        const latest = [...all].sort((a, b) => b.recordedAt - a.recordedAt)[0];
        const complete = fieldCount > 0 && fields >= fieldCount;
        const Icon = complete ? CircleCheck : latest ? CircleDot : CircleDashed;
        const id = `stage-${s.kind}`;
        return (
          <li key={s.kind} aria-labelledby={id} className="flex min-h-11 items-start gap-3 border-b border-border px-4 py-3 last:border-0">
            <Icon aria-hidden strokeWidth={1.5} className={`mt-0.5 size-4 shrink-0 ${complete ? "text-success" : "text-muted-foreground"}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span id={id} className="font-medium">
                  {s.label}
                </span>
                {latest ? <span className="tabular text-muted-foreground">{`${fields} of ${fieldCount} fields`}</span> : null}
              </div>
              {latest ? (
                <div className="tabular flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                  <span>{formatDateUtc(latest.recordedAt)}</span>
                  <ExplorerLink kind="address" value={latest.address} cluster={cluster} />
                  <a href={latest.evidenceUri} target="_blank" rel="noreferrer" className="rounded-sm text-foreground underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-foreground">
                    Evidence
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
  );
}

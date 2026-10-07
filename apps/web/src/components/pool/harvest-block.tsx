import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { formatTonnes } from "../../lib/format";
import type { DeliveryEvidence } from "../../lib/pilot-docs";

const VERDICT: Record<DeliveryEvidence["verdict"], string> = { Pass: "Passed the quality spec", Fail: "Did not pass the quality spec", InsufficientData: "Insufficient data" };

/** Harvest and quality once recorded: the elevator receipt and the lab protocol against the pool's spec. */
export function HarvestBlock({ elevator, lab, receipt, quality }: { elevator: string; lab: string; receipt: DeliveryEvidence | null; quality: DeliveryEvidence | null }) {
  if (!receipt && !quality) return null;
  return (
    <div className="grid items-start gap-6 rounded-lg border border-border bg-card p-6 md:grid-cols-[1fr_1.6fr] [&>*]:min-w-0">
      <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Elevator</dt>
        <dd>{elevator}</dd>
        <dt className="text-muted-foreground">Received</dt>
        <dd className="text-xl font-semibold">{receipt?.kg ? formatTonnes(receipt.kg) : "Not yet"}</dd>
        {receipt?.receivedOn ? (
          <>
            <dt className="text-muted-foreground">On</dt>
            <dd>{receipt.receivedOn}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Laboratory</dt>
        <dd>{lab}</dd>
        <dt className="text-muted-foreground">Result</dt>
        <dd className={quality?.verdict === "Pass" ? "font-medium text-success" : quality?.verdict === "Fail" ? "font-medium text-destructive" : "text-muted-foreground"}>{quality ? VERDICT[quality.verdict] : "Not yet"}</dd>
      </dl>
      {quality?.results?.length ? (
        <div className="relative overflow-x-auto" role="region" aria-label="Quality by parameter" tabIndex={0}>
          <table className="tabular w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Parameter</th>
                <th className="py-2 pr-3 font-medium">Requirement</th>
                <th className="py-2 pr-3 font-medium">Measured</th>
                <th className="py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {quality.results.map((r) => {
                const Icon = r.pass === true ? CircleCheck : r.pass === false ? CircleX : CircleDashed;
                return (
                  <tr key={r.key} className="border-t border-border">
                    <td className="py-2 pr-3">{r.label}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{r.requirement}</td>
                    <td className="py-2 pr-3">{r.measured ?? <span className="text-muted-foreground">Not measured</span>}</td>
                    <td className="py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 ${r.pass === true ? "text-success" : r.pass === false ? "text-destructive" : "text-muted-foreground"}`}>
                        <Icon aria-hidden strokeWidth={1.5} className="size-4" />
                        {r.pass === true ? "Passes" : r.pass === false ? "Fails" : "Missing"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

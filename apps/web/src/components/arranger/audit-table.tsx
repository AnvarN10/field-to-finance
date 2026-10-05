import { ExplorerLink } from "../explorer-link";

export type AuditView = { id: string; at: Date; actor: string; action: string; target: string; detail: string; signature: string | null; error: string | null };

/** `compact`: on one application's page the target column repeats itself, so it is dropped and the detail joins the action. */
export function AuditTable({ rows, cluster, compact = false }: { rows: AuditView[]; cluster: string; compact?: boolean }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No entries yet.</p>;
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card" role="region" aria-label="Audit log" tabIndex={0}>
      <table className="tabular w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Time (UTC)</th>
            <th className="px-3 py-2 font-medium">Who</th>
            <th className="px-3 py-2 font-medium">Action</th>
            {compact ? null : <th className="px-3 py-2 font-medium">Target</th>}
            <th className="px-3 py-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top first:border-t-0">
              <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{r.at.toISOString().slice(0, 19).replace("T", " ")}</td>
              <td className="max-w-48 truncate px-3 py-3" title={r.actor}>
                {r.actor}
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs whitespace-nowrap">{r.action}</span>
                  {compact && r.detail ? <span className="text-xs text-muted-foreground">{r.detail}</span> : null}
                </div>
              </td>
              {compact ? null : (
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span>{r.target}</span>
                    {r.detail ? <span className="text-xs text-muted-foreground">{r.detail}</span> : null}
                  </div>
                </td>
              )}
              <td className="px-3 py-3">
                {r.error ? (
                  <span className="text-destructive">{`Failed: ${r.error}`}</span>
                ) : r.signature ? (
                  <ExplorerLink kind="tx" value={r.signature} cluster={cluster} />
                ) : (
                  <span className="text-muted-foreground">Recorded</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { ExplorerLink } from "../explorer-link";

export type AuditView = { id: string; at: Date; actor: string; action: string; target: string; detail: string; signature: string | null; error: string | null };

/** `compact`: on one application's page the target column repeats itself, so it is dropped and the detail joins the action. */
export function AuditTable({ rows, cluster, compact = false }: { rows: AuditView[]; cluster: string; compact?: boolean }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No entries yet.</p>;
  const at = (r: AuditView) => r.at.toISOString().slice(0, 19).replace("T", " ");
  const result = (r: AuditView) =>
    r.error ? (
      <span className="text-destructive">{`Failed: ${r.error}`}</span>
    ) : r.signature ? (
      <ExplorerLink kind="tx" value={r.signature} cluster={cluster} />
    ) : (
      <span className="text-muted-foreground">Off-chain</span>
    );
  // Compact (one application's page): on phones a stacked list, because five columns cannot fit 390px.
  const list = compact ? (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-sm sm:hidden">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-1 p-3">
          <span className="tabular text-xs text-muted-foreground">{`${at(r)} UTC · ${r.actor}`}</span>
          <span className="text-sm">{r.action}</span>
          {r.detail ? <span className="text-xs text-muted-foreground">{r.detail}</span> : null}
          {r.error || r.signature ? <span className="text-xs">{result(r)}</span> : null}
        </li>
      ))}
    </ul>
  ) : null;
  return (
    <>
    {list}
    <div className={`relative overflow-x-auto rounded-lg border border-border bg-card ${compact ? "hidden sm:block" : ""}`} role="region" aria-label="Audit log" tabIndex={0}>
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
              <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{at(r)}</td>
              <td className="min-w-32 px-3 py-3 break-all md:min-w-64 md:break-normal">
                {r.actor}
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm">{r.action}</span>
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
              <td className="px-3 py-3 whitespace-nowrap">
                {result(r)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

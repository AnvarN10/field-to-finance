import { ExplorerLink } from "../explorer-link";

export type HistoryRow = { id: string; at: Date; label: string; amount: string | null; signature: string | null };

/** Transactions with explorer links; amounts already formatted. */
export function HistoryTable({ rows, empty, cluster }: { rows: HistoryRow[]; empty: string; cluster: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card" role="region" aria-label="Transaction history" tabIndex={0}>
      <table className="tabular w-full text-sm whitespace-nowrap">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Date (UTC)</th>
            <th className="px-3 py-2 font-medium">Event</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Transaction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border first:border-t-0">
              <td className="px-3 py-3 text-muted-foreground">{r.at.toISOString().slice(0, 16).replace("T", " ")}</td>
              <td className="px-3 py-3">{r.label}</td>
              <td className="px-3 py-3 text-right">{r.amount ?? <span className="text-muted-foreground">None</span>}</td>
              <td className="px-3 py-3">{r.signature ? <ExplorerLink kind="tx" value={r.signature} cluster={cluster} /> : <span className="text-muted-foreground">Off-chain</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

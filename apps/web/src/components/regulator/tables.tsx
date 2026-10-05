import Link from "next/link";
import { formatDateUtc, formatUsd, formatYield, shortKey } from "../../lib/format";
import type { EventRow, HolderRow, RegistryRow } from "../../lib/workflow/regulator";
import { actionLabel } from "../../lib/audit-labels";
import { ExplorerLink } from "../explorer-link";

const th = "px-3 py-2 font-medium whitespace-nowrap";
const td = "px-3 py-3 align-top";
const CATEGORY: Record<string, string> = { professional: "Professional", retail: "Retail", institutional: "Institutional" };

function Scroller({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground md:hidden">Scroll sideways for more columns.</p>
      <div className="relative overflow-x-auto rounded-lg border border-border bg-card" role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}

export function RegistryTable({ rows }: { rows: RegistryRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No pool matches these filters.</p>;
  return (
    <Scroller label="Registry">
      <table className="tabular w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className={th}>Instrument</th>
            <th className={th}>Status</th>
            <th className={th}>Issuer</th>
            <th className={th}>BIN</th>
            <th className={`${th} text-right`}>Raised</th>
            <th className={`${th} text-right`}>Coupon</th>
            <th className={th}>Maturity</th>
            <th className={`${th} text-right`}>Holders</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.poolId} className="border-t border-border first:border-t-0">
              <td className={td}>
                <Link href={`/regulator/pools/${r.poolId}`} className="font-medium underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current">
                  {r.symbol}
                </Link>
                <span className="block text-xs text-muted-foreground">{`Pool ${r.poolId}${r.settlementMode ? ` · ${r.settlementMode}` : ""}`}</span>
              </td>
              <td className={td}>{r.status}</td>
              <td className={`${td} min-w-40`}>
                {r.issuerLegalName ?? "Not in platform records"}
                <span className="block font-mono text-xs text-muted-foreground">{shortKey(r.issuerWallet)}</span>
              </td>
              <td className={td}>{r.issuerBin ?? "–"}</td>
              <td className={`${td} text-right whitespace-nowrap`}>
                {formatUsd(r.raised)}
                <span className="block text-xs text-muted-foreground">{`of ${formatUsd(r.target)}`}</span>
              </td>
              <td className={`${td} text-right`}>{r.couponBps !== null ? formatYield(r.couponBps) : "–"}</td>
              <td className={`${td} whitespace-nowrap`}>{formatDateUtc(r.maturityTs)}</td>
              <td className={`${td} text-right`}>{r.holders ?? (
                  <>
                    <span aria-hidden>–</span>
                    <span className="sr-only">Not available right now</span>
                  </>
                )}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroller>
  );
}

export function HoldersTable({ rows }: { rows: HolderRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No holders.</p>;
  return (
    <Scroller label="Holders">
      <table className="tabular w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className={th}>Wallet</th>
            <th className={`${th} text-right`}>Balance</th>
            <th className={th}>Category</th>
            <th className={th}>IIN</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={`${h.poolId}-${h.wallet}`} className="border-t border-border first:border-t-0">
              <td className={td}>
                <ExplorerLink kind="address" value={h.wallet} />
              </td>
              <td className={`${td} text-right`}>{formatUsd(h.balance)}</td>
              <td className={td}>{h.category ? CATEGORY[h.category] ?? h.category : "Not linked to an account"}</td>
              <td className={td}>{h.iin ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroller>
  );
}

export function EventsTable({ rows }: { rows: EventRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <Scroller label="Events">
      <table className="tabular w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className={th}>Time (UTC)</th>
            <th className={th}>Event</th>
            <th className={th}>Role</th>
            <th className={th}>Transaction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.at}-${i}`} className="border-t border-border first:border-t-0">
              <td className={`${td} whitespace-nowrap text-muted-foreground`}>{r.at.slice(0, 19).replace("T", " ")}</td>
              <td className={`${td} min-w-48`}>
                {actionLabel(r.action)}
                {r.detail ? <span className="block text-xs text-muted-foreground">{r.detail}</span> : null}
              </td>
              <td className={td}>{r.actingRole ?? "–"}</td>
              <td className={`${td} whitespace-nowrap`}>{r.signature ? <ExplorerLink kind="tx" value={r.signature} /> : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroller>
  );
}

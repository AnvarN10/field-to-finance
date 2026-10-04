"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useState } from "react";
import type { InvestorState } from "../../lib/chain/views";
import { formatUsd, formatUsdDown, withYield } from "../../lib/format";
import { KycDialog } from "../pool/kyc-dialog";
import { EmptyState, ErrorState } from "../state";
import { Button } from "../ui/button";
import { PoolStatusBadge } from "../status-badge";
import { useEnterOnce } from "../use-enter-once";
import { useJson } from "../use-json";
import { ConnectButton } from "../wallet/connect-button";
import { FaucetButton } from "../wallet/faucet-button";

const link = "rounded-sm text-primary underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current";

const positionAction = (status: string) => (status === "Redeeming" ? "Redeem" : status === "Refunding" ? "Refund" : "View pool");

export function PortfolioView() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const { data, error, loading, reload } = useJson<InvestorState>(wallet ? `/api/investor/${wallet}` : null);
  const [kycOpen, setKycOpen] = useState(false);
  const enter = useEnterOnce(Boolean(data));

  if (!wallet) return <EmptyState title="Connect a wallet" body="Your positions appear here once you connect a devnet wallet." action={<ConnectButton />} />;
  if (error) return <ErrorState title="Could not load your portfolio" body={error} onRetry={reload} />;
  if (loading || !data)
    return (
      <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading portfolio">
        <div className="h-20 skeleton-shimmer rounded-lg" />
        <div className="h-40 skeleton-shimmer rounded-lg" />
      </div>
    );

  const held = data.positions.filter((p) => BigInt(p.balance) > 0n);
  return (
    <div className="flex flex-col gap-8">
      {/* One strip with hairline dividers instead of three boxed tiles. */}
      <dl className="tabular grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Test USDC</dt>
          <dd className="text-xl font-semibold">{formatUsd(data.usdcBalance)}</dd>
        </div>
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">KYC</dt>
          <dd className={`text-xl font-semibold ${data.approved ? "text-success" : "text-foreground"}`}>{data.approved ? "Approved" : "Not completed"}</dd>
          {data.approved ? null : (
            <dd>
              <Button type="button" variant="link" className="h-auto px-0" onClick={() => setKycOpen(true)}>
                Complete KYC
              </Button>
            </dd>
          )}
        </div>
        <div className="flex flex-col gap-1 bg-card p-4">
          <dt className="text-xs text-muted-foreground">Positions</dt>
          <dd className="text-xl font-semibold">{held.length}</dd>
        </div>
      </dl>
      {held.length === 0 ? (
        <EmptyState
          title="No positions yet"
          body="Subscribe to an open pool to hold its Instrument."
          action={
            <Link href="/pools" className={link}>
              Browse pools
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card" role="region" aria-label="Positions table" tabIndex={0}>
          <table className="tabular w-full text-sm whitespace-nowrap">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Instrument</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Holding</th>
                <th className="px-3 py-2 text-right font-medium">At maturity</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {held.map((p, i) => (
                <tr key={p.pool} className={`border-t border-border ${enter(i).className}`} style={enter(i).style}>
                  <td className="px-3 py-3 font-medium">{p.symbol}</td>
                  <td className="px-3 py-3">
                    <PoolStatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-3 text-right">{formatUsd(p.balance)}</td>
                  <td className="px-3 py-3 text-right">{p.atMaturity !== undefined ? formatUsdDown(p.atMaturity) : formatUsd(withYield(BigInt(p.balance), p.yieldBps))}</td>
                  <td className="px-3 py-3 text-right">
                    {/* aria-label keeps the visible words first and adds the symbol, so repeated links are distinct. */}
                    <Link href={`/pools/${p.poolId}`} className={link} aria-label={`${positionAction(p.status)} ${p.symbol}`}>
                      {positionAction(p.status)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <FaucetButton wallet={wallet} usdc onDone={reload} />
      <KycDialog open={kycOpen} onOpenChange={setKycOpen} wallet={wallet} onApproved={reload} />
    </div>
  );
}

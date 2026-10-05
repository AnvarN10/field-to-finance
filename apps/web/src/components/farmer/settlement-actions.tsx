"use client";

import { useState } from "react";
import type { InvestorState } from "../../lib/chain/views";
import { formatDateUtc, formatUsd, formatUsdDown, shortKey } from "../../lib/format";
import type { TxSigner } from "../../lib/tx-client";
import { TxStatus } from "../tx/tx-status";
import { useTransaction } from "../tx/use-transaction";
import { Button } from "../ui/button";
import { useJson } from "../use-json";
import type { ObligationItem } from "./obligations";

/**
 * The issuer's settlement from the cabinet (ADR 0014): elect buyback or delivery before maturity on a hybrid pool, then
 * fund the buyback shortfall from the issuer wallet. Both are sponsored transactions signed by the Privy wallet.
 */
export function SettlementActions({ item, signer, now }: { item: ObligationItem; signer: TxSigner | null; now: number }) {
  const elect = useTransaction("elect-settlement", signer);
  const fund = useTransaction("fund-redemption", signer);
  const [confirmDelivery, setConfirmDelivery] = useState(false);
  const balance = useJson<InvestorState>(signer ? `/api/investor/${signer.publicKey}` : null);
  const electable = item.settlementMode === "Hybrid" && item.election === null && now <= item.maturityTs && (item.status === "Open" || item.status === "Funded");
  const fundable = item.effectiveElection === "Buyback" && item.status === "Funded";
  if (!electable && !fundable) return null;
  if (!signer) return <p className="text-sm text-muted-foreground">Your wallet signs the settlement. It loads after sign-in.</p>;
  if (signer.publicKey !== item.issuer) return <p className="text-sm text-muted-foreground">{`Sign in with the issuer wallet ${shortKey(item.issuer)} to elect or fund the buyback.`}</p>;
  const electionOpen = electable;
  const shortfall = BigInt(item.buybackShortfall);
  const buyback = item.effectiveElection === "Buyback";
  const usdc = balance.data ? BigInt(balance.data.usdcBalance) : null;
  const busy = elect.busy || fund.busy;
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      {electionOpen ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{`Elect before maturity, ${formatDateUtc(item.maturityTs)}. Without a buyback election grain delivery applies.`}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={busy} onClick={() => void elect.run({ poolId: item.poolId, election: "Buyback" })}>
              Elect buyback
            </Button>
            {!confirmDelivery ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmDelivery(true)}>
                Elect delivery
              </Button>
            ) : null}
          </div>
          {confirmDelivery ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
              <span className="mr-auto">Delivery is final: holders claim grain at the elevator instead of cash.</span>
              <Button type="button" size="sm" variant="destructive" onClick={() => { setConfirmDelivery(false); void elect.run({ poolId: item.poolId, election: "Delivery" }); }}>
                Yes, elect delivery
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelivery(false)}>
                Cancel
              </Button>
            </div>
          ) : null}
          <TxStatus state={elect.state} onAction={(a) => a === "retry" && void elect.retry()} successLabel="Election recorded on-chain" />
        </div>
      ) : null}
      {buyback && item.status === "Funded" ? (
        shortfall > 0n ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{`Fund by maturity, ${formatDateUtc(item.maturityTs)}. Unfunded after ${formatDateUtc(item.lapseTs)} the buyback lapses into delivery.`}</p>
            {usdc !== null ? <p className="tabular text-sm text-muted-foreground">{`Your wallet holds ${formatUsd(usdc)}${usdc < shortfall ? ": ask the arranger for test USDC to cover the rest" : ""}.`}</p> : null}
            <Button type="button" className="self-start" disabled={busy || !item.allDisbursed} onClick={() => void fund.run({ poolId: item.poolId, amount: shortfall.toString() })}>
              {`Fund buyback · ${formatUsdDown(shortfall)}`}
            </Button>
            {!item.allDisbursed ? <p className="text-xs text-muted-foreground">Deposits open once the proceeds are disbursed.</p> : null}
            <TxStatus state={fund.state} onAction={(a) => a === "retry" && void fund.retry()} successLabel="Buyback funded" />
          </div>
        ) : (
          <p className="text-sm text-success">The buyback is fully funded. Redemption opens after maturity.</p>
        )
      ) : null}
    </div>
  );
}

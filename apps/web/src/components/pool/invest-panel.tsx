"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { CircleAlert, CircleCheck, Fuel } from "lucide-react";
import { useRef, useState } from "react";
import type { ErrorAction } from "../../lib/chain/explain";
import type { InvestorState, PoolView } from "../../lib/chain/views";
import { formatDateUtc, formatUsd, formatYield, parseUsd, withYield } from "../../lib/format";
import { disconnectedCopy, panelMode, positionFor, subscriptionTotal, validateSubscription } from "../../lib/invest";
import { remaining } from "../../lib/pool-math";
import { TxStatus } from "../tx/tx-status";
import { useTransaction } from "../tx/use-transaction";
import { Button } from "../ui/button";
import { useJson } from "../use-json";
import { ConnectButton } from "../wallet/connect-button";
import { FaucetButton } from "../wallet/faucet-button";
import { useAdapterSigner } from "../wallet/use-adapter-signer";
import { KycDialog } from "./kyc-dialog";

function typedAmount(input: string): bigint {
  try {
    const v = parseUsd(input);
    return v > 0n ? v : 0n;
  } catch {
    return 0n;
  }
}

/** `networkFee`: FeeConfig.network_fee in USDC base units, or null while fees are not configured (ADR 0013). */
export function InvestPanel({ pool, networkFee }: { pool: PoolView; networkFee: string | null }) {
  const { publicKey } = useWallet();
  const signer = useAdapterSigner();
  const wallet = publicKey?.toBase58() ?? null;
  const investor = useJson<InvestorState>(wallet ? `/api/investor/${wallet}` : null);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [kycOpen, setKycOpen] = useState(false);
  const [showFaucet, setShowFaucet] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const subscribe = useTransaction("subscribe", signer, { onSuccess: investor.reload });
  const refund = useTransaction("refund", signer, { onSuccess: investor.reload });
  const redeem = useTransaction("redeem", signer, { onSuccess: investor.reload });

  const mode = panelMode(pool, Math.floor(Date.now() / 1000));
  const position = positionFor(investor.data, pool.poolId);
  const kycDone = Boolean(investor.data?.approved);
  const balance = BigInt(position?.balance ?? "0");
  const symbol = pool.instrument?.symbol ?? `POOL-${pool.poolId}`;
  const usdc = BigInt(investor.data?.usdcBalance ?? "0");
  const fee = BigInt(networkFee ?? "0");
  const typed = typedAmount(amount);
  const total = subscriptionTotal(typed, fee);

  // Each transaction gets its own handler so "Try again" re-sends that transaction.
  const handlerFor = (tx: { retry: () => Promise<unknown> }) => (a: ErrorAction) => {
    if (a === "kyc") setKycOpen(true);
    if (a === "faucet") setShowFaucet(true);
    if (a === "retry") void tx.retry();
  };

  if (!wallet) {
    return (
      <Panel title="Invest">
        <p className="text-sm text-muted-foreground">{disconnectedCopy(mode, pool.yieldBps)}</p>
        <div>
          <ConnectButton />
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Invest">
      <dl className="tabular flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">KYC</dt>
          <dd className={`inline-flex items-center gap-1.5 font-medium ${kycDone ? "text-success" : "text-foreground"}`}>
            {investor.data ? (
              kycDone ? (
                <CircleCheck aria-hidden strokeWidth={1.5} className="size-4" />
              ) : (
                <CircleAlert aria-hidden strokeWidth={1.5} className="size-4" />
              )
            ) : null}
            {investor.data ? (kycDone ? "Approved" : "Not completed") : <span className="text-muted-foreground">Checking</span>}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Test USDC</dt>
          <dd>{investor.data ? formatUsd(investor.data.usdcBalance) : <span className="text-muted-foreground">Loading</span>}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">You hold</dt>
          <dd>{`${formatUsd(balance)} of ${symbol}`}</dd>
        </div>
      </dl>
      {investor.error ? (
        <p role="alert" className="text-sm text-destructive">
          {investor.error}
        </p>
      ) : null}

      {mode === "subscribe" && investor.data && !kycDone ? (
        <div className="flex flex-col items-start gap-2 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">KYC comes first: one approval covers every pool.</p>
          <Button type="button" size="lg" className="text-base" onClick={() => setKycOpen(true)}>
            Complete KYC
          </Button>
        </div>
      ) : null}

      {mode === "subscribe" ? (
        <form
          noValidate
          className="flex flex-col gap-2 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validateSubscription(amount, remaining(pool), { networkFee: fee, usdcBalance: investor.data ? usdc : null });
            if (!v.ok) {
              setAmountError(v.message);
              if (v.reason === "balance") setShowFaucet(true);
              amountRef.current?.focus();
              return;
            }
            setAmountError(null);
            void subscribe.run({ poolId: pool.poolId, amount: v.amount.toString() });
          }}
        >
          <label htmlFor="amount" className="text-sm font-medium">
            Amount (USD)
          </label>
          <input
            ref={amountRef}
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Up to ${formatUsd(remaining(pool))}`}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? "amount-error" : "amount-hint"}
            className="tabular h-10 rounded-md border border-input bg-card px-3 text-base aria-[invalid=true]:border-destructive"
          />
          {amountError ? (
            <p id="amount-error" className="text-sm text-destructive">
              {amountError}
            </p>
          ) : (
            <p id="amount-hint" className="text-xs text-muted-foreground">
              {`Fixed yield ${formatYield(pool.yieldBps)}. Paid at maturity, ${formatDateUtc(pool.maturityTs)}.`}
            </p>
          )}
          <div role="group" aria-label="Payment summary" className="tabular mt-2 flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <span>{formatUsd(typed)}</span>
            </div>
            {networkFee !== null ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Network fee</span>
                <span>{formatUsd(fee)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5 font-medium">
              <span>Total</span>
              <span>{formatUsd(total)}</span>
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Fuel aria-hidden strokeWidth={1.5} className="mt-px size-3.5 shrink-0" />
            No SOL needed. Field-to-Finance pays the Solana transaction fee and account rent for you.
          </p>
          <Button type="submit" size="lg" disabled={subscribe.busy} className="mt-2 text-base">
            {typed > 0n ? `Subscribe · ${formatUsd(total)}` : "Subscribe"}
          </Button>
          <TxStatus state={subscribe.state} onAction={handlerFor(subscribe)} successLabel={`Subscribed. ${symbol} is in your wallet.`} />
        </form>
      ) : null}

      {mode === "draft" ? <p className="text-sm text-muted-foreground">This pool is not open yet.</p> : null}
      {mode === "closed" ? <p className="text-sm text-muted-foreground">Subscription has ended. The Issuer closes the pool next.</p> : null}
      {mode === "closed-funded" ? (
        <p className="text-sm text-muted-foreground">{`Funded. Redemption opens after maturity on ${formatDateUtc(pool.maturityTs)} once the Issuer deposits principal plus yield.`}</p>
      ) : null}

      {mode === "refund" ? (
        <HolderAction
          disabled={balance === 0n || refund.busy}
          label={`Refund ${formatUsd(balance)}`}
          note="The pool closed under target. Refunds return your USDC and burn the Instrument."
          onClick={() => void refund.run({ poolId: pool.poolId, amount: balance.toString() })}
        >
          <TxStatus state={refund.state} onAction={handlerFor(refund)} successLabel="Refunded" />
        </HolderAction>
      ) : null}

      {mode === "redeem" ? (
        <HolderAction
          disabled={balance === 0n || redeem.busy}
          label={`Redeem for ${formatUsd(withYield(balance, pool.yieldBps))}`}
          note="Burns your Instrument and pays principal plus the fixed yield."
          onClick={() => void redeem.run({ poolId: pool.poolId, amount: balance.toString() })}
        >
          <TxStatus state={redeem.state} onAction={handlerFor(redeem)} successLabel="Redeemed" />
        </HolderAction>
      ) : null}

      {showFaucet || (investor.data && usdc === 0n) ? (
        <div className="flex flex-col items-start gap-3 border-t border-border pt-4">
          {showFaucet || (investor.data && usdc === 0n) ? <FaucetButton wallet={wallet} usdc onDone={investor.reload} /> : null}
        </div>
      ) : null}

      <KycDialog open={kycOpen} onOpenChange={setKycOpen} wallet={wallet} onApproved={investor.reload} />
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby="invest-title" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <h2 id="invest-title" className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function HolderAction({ label, note, disabled, onClick, children }: { label: string; note: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">{note}</p>
      <Button type="button" size="lg" disabled={disabled} onClick={onClick} className="text-base">
        {label}
      </Button>
      {children}
    </div>
  );
}

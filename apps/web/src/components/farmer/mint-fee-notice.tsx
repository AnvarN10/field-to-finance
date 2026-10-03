"use client";

import { Fuel } from "lucide-react";
import { formatUsd, formatYield } from "../../lib/format";
import { FaucetButton } from "../wallet/faucet-button";

/** USDC the producer still needs for the mint fee (ADR 0013); 0 when fees are off or the wallet covers it. */
export function mintFeeShortfall(usdcBalance: bigint, mintFee: string | null): bigint {
  const fee = BigInt(mintFee ?? "0");
  return usdcBalance >= fee ? 0n : fee - usdcBalance;
}

/** Discloses the registration (mint) fee before the farmer signs, with a faucet when the wallet cannot pay it. */
export function MintFeeNotice({
  wallet,
  mintFee,
  usdcBalance,
  maxArrangementBps,
  onFunded,
}: {
  wallet: string;
  mintFee: string | null;
  usdcBalance: bigint | null;
  maxArrangementBps: number | null;
  onFunded?: () => void;
}) {
  const fee = BigInt(mintFee ?? "0");
  const short = usdcBalance === null ? 0n : mintFeeShortfall(usdcBalance, mintFee);
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5 text-sm">
      <dl className="tabular flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Registration fee</dt>
          <dd className="font-medium">{formatUsd(fee)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Your test USDC</dt>
          <dd>{usdcBalance === null ? <span className="text-muted-foreground">Loading</span> : formatUsd(usdcBalance)}</dd>
        </div>
      </dl>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Fuel aria-hidden strokeWidth={1.5} className="mt-px size-3.5 shrink-0" />
        {fee > 0n
          ? `Paid once in USDC when you register. Field-to-Finance pays the Solana fees and account rent, so you need no SOL.`
          : "Field-to-Finance pays the Solana fees and account rent, so you need no SOL."}
      </p>
      {maxArrangementBps !== null ? (
        <p className="text-xs text-muted-foreground">{`When a pool pays you, an arrangement fee of at most ${formatYield(maxArrangementBps)} (set per pool and shown on the pool page) is withheld from the amount.`}</p>
      ) : null}
      {short > 0n ? (
        <div className="flex flex-col items-start gap-2">
          <p role="status">{`You need ${formatUsd(fee)} in test USDC to register.`}</p>
          <FaucetButton wallet={wallet} usdc onDone={onFunded} />
        </div>
      ) : null}
    </div>
  );
}

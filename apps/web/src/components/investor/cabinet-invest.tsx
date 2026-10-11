"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import type { PoolView } from "../../lib/chain/views";
import { shortKey } from "../../lib/format";
import { useAuth } from "../auth/auth-context";
import { InvestPanel } from "../pool/invest-panel";

/**
 * The pool's invest panel inside the cabinet. A connected Phantom signs only when it is linked to this account;
 * otherwise the investor's email wallet does, so a wallet left connected from another account never pays for this one.
 */
export function CabinetInvest({ pool, networkFee, linkedWallets }: { pool: PoolView; networkFee: string | null; linkedWallets: string[] }) {
  const auth = useAuth();
  const { publicKey } = useWallet();
  const adapter = publicKey?.toBase58() ?? null;
  const useAdapter = adapter !== null && linkedWallets.includes(adapter);
  return (
    <div className="flex flex-col gap-3">
      {adapter && !useAdapter ? (
        <p className="text-sm text-muted-foreground">{`The connected wallet ${shortKey(adapter)} is not linked to this account, so your email wallet pays.`}</p>
      ) : null}
      <InvestPanel pool={pool} networkFee={networkFee} signer={useAdapter ? undefined : auth.signer} />
    </div>
  );
}

"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import type { PoolView } from "../../lib/chain/views";
import { useAuth } from "../auth/auth-context";
import { InvestPanel } from "../pool/invest-panel";

/** The pool's invest panel inside the cabinet: a connected Phantom signs; otherwise the investor's email wallet does. */
export function CabinetInvest({ pool, networkFee }: { pool: PoolView; networkFee: string | null }) {
  const auth = useAuth();
  const { connected } = useWallet();
  return <InvestPanel pool={pool} networkFee={networkFee} signer={connected ? undefined : auth.signer} />;
}

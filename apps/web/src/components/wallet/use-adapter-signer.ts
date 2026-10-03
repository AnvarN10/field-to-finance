"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import type { TxSigner } from "../../lib/tx-client";

/** Sign-only: the server co-signs as gas sponsor and submits (ADR 0013), so the wallet needs no SOL. */
export function useAdapterSigner(): TxSigner | null {
  const { publicKey, signTransaction } = useWallet();
  return useMemo(() => {
    if (!publicKey || !signTransaction) return null;
    return { publicKey: publicKey.toBase58(), sign: (tx) => signTransaction(tx) };
  }, [publicKey, signTransaction]);
}

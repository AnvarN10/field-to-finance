"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import type { TxSigner } from "../../lib/tx-client";

export function useAdapterSigner(): TxSigner | null {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  return useMemo(
    () => (publicKey ? { publicKey: publicKey.toBase58(), signAndSend: (tx) => sendTransaction(tx, connection, { skipPreflight: false }) } : null),
    [publicKey, sendTransaction, connection],
  );
}

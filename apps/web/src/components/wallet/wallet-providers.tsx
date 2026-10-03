"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import type { ReactNode } from "react";
import { publicEnv } from "../../lib/public-env";

/** Phantom, Solflare and Backpack register through Wallet Standard, so no adapter list is needed. */
export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={publicEnv.NEXT_PUBLIC_SOLANA_RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

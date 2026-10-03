"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import { useMemo, type ReactNode } from "react";
import { track } from "../../lib/analytics";
import type { TxSigner } from "../../lib/tx-client";
import { FarmerSessionContext } from "./farmer-session";

function Bridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const wallet = wallets.find((w) => w.standardWallet.name === "Privy") ?? wallets[0];

  const signer = useMemo<TxSigner | null>(
    () =>
      wallet
        ? {
            publicKey: wallet.address,
            // Sign only: the server adds the gas sponsor's signature and submits (ADR 0013).
            async sign(tx) {
              const { signedTransaction } = await signTransaction({ transaction: tx.serialize(), wallet, chain: "solana:devnet" });
              return VersionedTransaction.deserialize(signedTransaction);
            },
          }
        : null,
    [wallet, signTransaction],
  );

  return (
    <FarmerSessionContext.Provider
      value={{
        mode: "privy",
        ready,
        authenticated,
        email: user?.email?.address ?? null,
        signer,
        login: () => {
          track("farmer_login");
          login();
        },
        logout: () => void logout(),
      }}
    >
      {children}
    </FarmerSessionContext.Provider>
  );
}

export default function PrivyFarmer({ appId, rpcUrl, children }: { appId: string; rpcUrl: string; children: ReactNode }) {
  const wsUrl = rpcUrl.replace(/^http/, "ws");
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        appearance: { theme: "dark", accentColor: "#F2C14E", walletChainType: "solana-only" },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
        solana: {
          rpcs: {
            "solana:devnet": { rpc: createSolanaRpc(rpcUrl), rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl) },
          },
        },
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}

"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import bs58 from "bs58";
import { useMemo, type ReactNode } from "react";
import { track } from "../../lib/analytics";
import type { TxSigner } from "../../lib/tx-client";
import { FarmerSessionContext } from "./farmer-session";

function Bridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const wallet = wallets.find((w) => w.standardWallet.name === "Privy") ?? wallets[0];

  const signer = useMemo<TxSigner | null>(
    () =>
      wallet
        ? {
            publicKey: wallet.address,
            async signAndSend(tx) {
              const { signature } = await signAndSendTransaction({ transaction: tx.serialize(), wallet, chain: "solana:devnet" });
              return bs58.encode(signature);
            },
          }
        : null,
    [wallet, signAndSendTransaction],
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
        appearance: { theme: "light", accentColor: "#142d23", walletChainType: "solana-only" },
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

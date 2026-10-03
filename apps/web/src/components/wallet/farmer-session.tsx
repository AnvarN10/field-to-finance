"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import dynamic from "next/dynamic";
import { createContext, useContext, type ReactNode } from "react";
import { publicEnv } from "../../lib/public-env";
import type { TxSigner } from "../../lib/tx-client";
import { useAdapterSigner } from "./use-adapter-signer";

export interface FarmerSession {
  mode: "privy" | "adapter";
  ready: boolean;
  authenticated: boolean;
  email: string | null;
  signer: TxSigner | null;
  login(): void;
  logout(): void;
}

const Ctx = createContext<FarmerSession | null>(null);
export const FarmerSessionContext = Ctx;

export function useFarmerSession(): FarmerSession {
  const s = useContext(Ctx);
  if (!s) throw new Error("useFarmerSession must be used inside FarmerSessionProvider");
  return s;
}

function AdapterSession({ children }: { children: ReactNode }) {
  const { connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const signer = useAdapterSigner();
  return (
    <Ctx.Provider value={{ mode: "adapter", ready: true, authenticated: connected, email: null, signer, login: () => setVisible(true), logout: () => void disconnect() }}>
      {children}
    </Ctx.Provider>
  );
}

// Privy's bundle loads only on the farmer page, and only when an app id is configured.
const PrivySession = dynamic(() => import("./privy-farmer"), { ssr: false });

export function FarmerSessionProvider({ children }: { children: ReactNode }) {
  const appId = publicEnv.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <AdapterSession>{children}</AdapterSession>;
  return (
    <PrivySession appId={appId} rpcUrl={publicEnv.NEXT_PUBLIC_SOLANA_RPC_URL}>
      {children}
    </PrivySession>
  );
}

"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { publicEnv } from "../../lib/public-env";
import { AuthContext, type AuthSession } from "./auth-context";

type PrivyAuthComponent = ComponentType<{ appId: string; rpcUrl: string; children: ReactNode }>;

const clearSession = async () => {
  await fetch("/api/session", { method: "DELETE" }).catch(() => null);
};

const base = { authenticated: false, email: null, signer: null, embeddedWallet: null, server: { state: "idle" as const }, login: () => {}, logout: clearSession, resync: async () => {} };
const unconfigured: AuthSession = { ...base, mode: "unconfigured", ready: true };
const loading: AuthSession = { ...base, mode: "privy", ready: false };

/**
 * Privy only in the cabinets and on sign-in. The server-rendered cabinet shows at once; Privy's bundle loads after
 * hydration and takes over the auth context (ready: false until then).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const appId = publicEnv.NEXT_PUBLIC_PRIVY_APP_ID;
  const [PrivyAuth, setPrivyAuth] = useState<PrivyAuthComponent | null>(null);
  useEffect(() => {
    if (!appId) return;
    let live = true;
    void import("./privy-auth").then((m) => {
      if (live) setPrivyAuth(() => m.default);
    });
    return () => {
      live = false;
    };
  }, [appId]);
  if (!appId) return <AuthContext.Provider value={unconfigured}>{children}</AuthContext.Provider>;
  if (!PrivyAuth) return <AuthContext.Provider value={loading}>{children}</AuthContext.Provider>;
  return (
    <PrivyAuth appId={appId} rpcUrl={publicEnv.NEXT_PUBLIC_SOLANA_RPC_URL}>
      {children}
    </PrivyAuth>
  );
}

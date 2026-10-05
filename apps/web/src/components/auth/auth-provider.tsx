"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { publicEnv } from "../../lib/public-env";
import { AuthContext } from "./auth-context";

// Privy's bundle loads only in the cabinets and on sign-in, never on the landing or pool pages.
const PrivyAuth = dynamic(() => import("./privy-auth"), {
  ssr: false,
  loading: () => <div className="skeleton-shimmer h-40 rounded-lg" role="status" aria-label="Loading sign-in" />,
});

const unconfigured = {
  mode: "unconfigured" as const,
  ready: true,
  authenticated: false,
  email: null,
  signer: null,
  embeddedWallet: null,
  server: { state: "idle" as const },
  login: () => {},
  logout: async () => {
    await fetch("/api/session", { method: "DELETE" }).catch(() => null);
  },
  resync: async () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const appId = publicEnv.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <AuthContext.Provider value={unconfigured}>{children}</AuthContext.Provider>;
  return (
    <PrivyAuth appId={appId} rpcUrl={publicEnv.NEXT_PUBLIC_SOLANA_RPC_URL}>
      {children}
    </PrivyAuth>
  );
}

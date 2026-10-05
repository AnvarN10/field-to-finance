"use client";

import { createContext, useContext } from "react";
import type { Role } from "../../lib/db/schema";
import type { TxSigner } from "../../lib/tx-client";

/** Whether the server accepted the Privy token (POST /api/session) and which roles the account holds. */
export type ServerSession = { state: "idle" } | { state: "syncing" } | { state: "ready"; roles: Role[] } | { state: "error"; message: string };

export interface AuthSession {
  /** "unconfigured" when NEXT_PUBLIC_PRIVY_APP_ID is missing: sign-in cannot work. */
  mode: "privy" | "unconfigured";
  ready: boolean;
  authenticated: boolean;
  email: string | null;
  /** The Privy embedded Solana wallet as a signer (farmers; investors may use it too). */
  signer: TxSigner | null;
  embeddedWallet: string | null;
  server: ServerSession;
  login(): void;
  logout(): Promise<void>;
  resync(): Promise<void>;
}

export const AuthContext = createContext<AuthSession | null>(null);

export function useAuth(): AuthSession {
  const s = useContext(AuthContext);
  if (!s) throw new Error("useAuth must be used inside AuthProvider");
  return s;
}

"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { track } from "../../lib/analytics";
import type { Role } from "../../lib/db/schema";
import type { TxSigner } from "../../lib/tx-client";
import { AuthContext, type ServerSession } from "./auth-context";

/** Privy access tokens live about an hour; re-post well before that so the session cookie never lapses mid-task. */
const RESYNC_MS = 10 * 60_000;

function Bridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const wallet = wallets.find((w) => w.standardWallet.name === "Privy") ?? null;
  const [server, setServer] = useState<ServerSession>({ state: "idle" });
  const inFlight = useRef(false);

  const sync = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setServer((s) => (s.state === "ready" ? s : { state: "syncing" }));
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Privy returned no access token. Sign in again.");
      const res = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; roles?: Role[]; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Sign-in failed. Try again.");
      setServer({ state: "ready", roles: body.roles ?? [] });
    } catch (e) {
      setServer({ state: "error", message: e instanceof Error ? e.message : "Sign-in failed. Try again." });
    } finally {
      inFlight.current = false;
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    void sync();
    const t = setInterval(() => void sync(), RESYNC_MS);
    return () => clearInterval(t);
    // A new embedded wallet is reported on the next sync, so the server records it.
  }, [ready, authenticated, sync, wallet?.address]);

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
    <AuthContext.Provider
      value={{
        mode: "privy",
        ready,
        authenticated,
        email: user?.email?.address ?? null,
        signer,
        embeddedWallet: wallet?.address ?? null,
        server,
        login: () => {
          track("farmer_login");
          login();
        },
        logout: async () => {
          await fetch("/api/session", { method: "DELETE" }).catch(() => null);
          await logout();
          setServer({ state: "idle" });
        },
        resync: sync,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default function PrivyAuth({ appId, rpcUrl, children }: { appId: string; rpcUrl: string; children: ReactNode }) {
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

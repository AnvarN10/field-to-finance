"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { linkPhantomAction } from "../../app/(app)/invest/actions";
import { walletLinkMessage } from "../../lib/wallet-link-message";
import { Button } from "../ui/button";
import { ConnectButton } from "../wallet/connect-button";

/** Links the connected Wallet Standard wallet (Phantom, Solflare, Backpack) by signing a short message. No transaction, no fee. */
export function LinkPhantom({ userId, linked }: { userId: string; linked: string[] }) {
  const { publicKey, signMessage, connected } = useWallet();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const address = publicKey?.toBase58() ?? null;

  if (!connected || !address) {
    return (
      <div className="flex flex-col items-start gap-2 text-sm">
        <p className="text-muted-foreground">Investing from Phantom? Connect it here and sign a message to link it. Signing costs nothing.</p>
        <ConnectButton variant="outline" />
      </div>
    );
  }
  if (linked.includes(address)) return <p className="text-sm text-muted-foreground">The connected wallet is linked.</p>;
  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      <p className="text-muted-foreground">{`Connected ${address.slice(0, 4)}…${address.slice(-4)}. Sign a message to prove it is yours.`}</p>
      <Button
        type="button"
        variant="outline"
        disabled={busy || !signMessage}
        onClick={async () => {
          if (!signMessage) return;
          setBusy(true);
          setError(null);
          try {
            const message = walletLinkMessage(userId, address, new Date().toISOString());
            const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
            const r = await linkPhantomAction(address, message, signature);
            if (r.ok) router.refresh();
            else setError(r.error);
          } catch {
            setError("The wallet did not sign. Nothing was linked; try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Waiting for the wallet" : "Link this wallet"}
      </Button>
      {!signMessage ? <p className="text-muted-foreground">This wallet cannot sign messages. Use Phantom, Solflare or Backpack.</p> : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/** Sentence-case labels for the adapter button (its defaults say "Select Wallet" and "Connect"). */
export const WALLET_LABELS = {
  "no-wallet": "Connect wallet",
  "has-wallet": "Connect wallet",
  connecting: "Connecting",
  "copy-address": "Copy address",
  copied: "Copied",
  "change-wallet": "Change wallet",
  disconnect: "Disconnect",
} as const;

// The adapter button reads window.solana; render it only in the browser.
const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.BaseWalletMultiButton), {
  ssr: false,
  loading: () => <span className="inline-block h-9 w-32 rounded-md bg-muted" aria-hidden />,
});

export function ConnectButton() {
  return (
    <WalletMultiButton
      labels={WALLET_LABELS}
      style={{ height: 36, borderRadius: 6, background: "var(--primary)", fontFamily: "inherit", fontSize: 14 }}
    />
  );
}

/** Header slot: farmers sign in by email on /farmer, so the investor wallet button stays out of their way there. */
export function HeaderWalletButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/farmer")) return null;
  return <ConnectButton />;
}

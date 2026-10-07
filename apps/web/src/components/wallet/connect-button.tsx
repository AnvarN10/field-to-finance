"use client";

import dynamic from "next/dynamic";

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
  loading: () => <span className="skeleton-shimmer inline-block h-9 w-32 rounded-md" aria-hidden />,
});

const BASE = { height: 36, borderRadius: 6, fontFamily: "inherit", fontSize: 14, fontWeight: 600 } as const;
const STYLES = {
  // Wheat: the primary action of the page (pool page invest panel).
  default: { ...BASE, background: "var(--primary)", color: "var(--primary-foreground)" },
  // Optional or secondary (linking Phantom in onboarding): wheat stays on the page's one primary action.
  outline: { ...BASE, background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--input)" },
} as const;

export function ConnectButton({ variant = "default" }: { variant?: keyof typeof STYLES }) {
  return <WalletMultiButton labels={WALLET_LABELS} style={STYLES[variant]} />;
}

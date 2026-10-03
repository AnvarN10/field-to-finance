"use client";

import { useWallet } from "@solana/wallet-adapter-react";
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
  loading: () => <span className="skeleton-shimmer inline-block h-9 w-32 rounded-md" aria-hidden />,
});

export function ConnectButton() {
  return (
    <WalletMultiButton
      labels={WALLET_LABELS}
      style={{ height: 36, borderRadius: 6, background: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "inherit", fontSize: 14, fontWeight: 600 }}
    />
  );
}

/** Pages whose body already shows a Connect wallet call to action while no wallet is connected. */
export const pageHasConnect = (pathname: string) => /^\/pools\/[^/]+$/.test(pathname) || pathname === "/portfolio";

/**
 * Header slot: farmers sign in by email on /farmer, so the investor wallet button stays out of their way there.
 * On phones, a page that shows its own Connect wallet button hides the header one until a wallet connects,
 * so only one Connect wallet button is visible at 390px.
 */
export function HeaderWalletButton() {
  const pathname = usePathname() ?? "/";
  const { connected } = useWallet();
  if (pathname.startsWith("/farmer")) return null;
  const duplicate = !connected && pageHasConnect(pathname);
  return (
    <span data-phone-hidden={duplicate || undefined} className={duplicate ? "max-sm:hidden" : "contents"}>
      <ConnectButton />
    </span>
  );
}

"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

// The adapter button reads window.solana; render it only in the browser.
const WalletMultiButton = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), {
  ssr: false,
  loading: () => <span className="inline-block h-9 w-32 rounded-md bg-muted" aria-hidden />,
});

export function ConnectButton() {
  return <WalletMultiButton style={{ height: 36, borderRadius: 6, background: "var(--primary)", fontFamily: "inherit", fontSize: 14 }} />;
}

/** Header slot: farmers sign in by email on /farmer, so the investor wallet button stays out of their way there. */
export function HeaderWalletButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/farmer")) return null;
  return <ConnectButton />;
}

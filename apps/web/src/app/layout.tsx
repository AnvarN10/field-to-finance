import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ConnectButton } from "@/components/wallet/connect-button";
import { WalletProviders } from "@/components/wallet/wallet-providers";
import "./globals.css";

const brand = Instrument_Sans({ subsets: ["latin"], variable: "--font-brand", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Field-to-Finance", template: "%s · Field-to-Finance" },
  description: "Farmers raise working capital against next season's harvest. Investors earn a fixed USDC yield on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${brand.variable} ${code.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <WalletProviders>
          <SiteHeader walletSlot={<ConnectButton />} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
          <SiteFooter />
        </WalletProviders>
      </body>
    </html>
  );
}

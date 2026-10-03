import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MAIN_ID, SkipLink } from "@/components/skip-link";
import { HeaderWalletButton } from "@/components/wallet/connect-button";
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
    <html lang="en" className={`dark ${brand.variable} ${code.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <SkipLink />
        <WalletProviders>
          <SiteHeader walletSlot={<HeaderWalletButton />} />
          <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 focus:outline-none">{children}</main>
          <SiteFooter />
        </WalletProviders>
      </body>
    </html>
  );
}

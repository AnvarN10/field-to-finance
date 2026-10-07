import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { SkipLink } from "@/components/skip-link";
import { WalletProviders } from "@/components/wallet/wallet-providers";
import { introSeenScript } from "@/lib/intro-seen";
import "./globals.css";

const brand = Instrument_Sans({ subsets: ["latin"], variable: "--font-brand", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Field-to-Finance", template: "%s · Field-to-Finance" },
  description: "Farmers raise working capital against next season's harvest. Investors earn a fixed USDC yield on Solana.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: introSeenScript may add data-seen to <html> before React hydrates.
    <html lang="en" className={`dark ${brand.variable} ${code.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introSeenScript }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <SkipLink />
        {/* Each route group brings its own shell: (site) the public header, (app) the app top bar, console the left nav. */}
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}

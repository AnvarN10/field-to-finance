import { BadgeCheck, FileText, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { DoorSignup } from "@/components/doors/door-signup";
import { currentUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Open an investor account" };
export const dynamic = "force-dynamic";

const STEPS = [
  { Icon: BadgeCheck, title: "Verify once", body: "Category and limits, an identity check reviewed by compliance, and a risk acknowledgement." },
  { Icon: FileText, title: "Read each pool's key features", body: "Crop, volume, coupon, maturity, settlement and main risks, before your first subscription." },
  { Icon: Wallet, title: "Subscribe with USDC", body: "A secure wallet comes with your account; network fees are covered, so you need no SOL." },
];

/** The investor door (ADR 0018): what investing involves, the risk warning, then email sign-up. */
export default async function InvestorSignup() {
  const user = await currentUser().catch(() => null);
  if (user?.roles.includes("investor")) redirect("/invest");
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 py-6 lg:grid-cols-[1fr_380px] [&>*]:min-w-0">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold">Invest in next season&apos;s harvest</h1>
          <p className="max-w-prose text-muted-foreground">Fixed-coupon instruments backed by verified farm projects, settled in USDC on Solana after harvest.</p>
        </header>
        <ol className="flex flex-col gap-5">
          {STEPS.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <Icon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">{title}</h2>
                <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="max-w-prose border-s-2 border-border ps-4 text-sm text-muted-foreground">
          Investing involves risk: harvests can fall short, and you can lose part or all of what you invest. This is a devnet pilot with test USDC; nothing here is an offer of securities.
        </p>
      </div>
      <section aria-labelledby="signup" className="flex flex-col gap-5 self-start rounded-lg border border-border bg-card p-6">
        <h2 id="signup" className="text-xl font-semibold">
          Open an investor account
        </h2>
        <AuthProvider>
          <DoorSignup door="investor" />
        </AuthProvider>
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-foreground underline decoration-muted-foreground underline-offset-4">
            Sign in
          </Link>
          . Raising money for a farm?{" "}
          <Link href="/apply" className="font-medium text-foreground underline decoration-muted-foreground underline-offset-4">
            Get financing
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

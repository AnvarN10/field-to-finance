import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { primaryLink } from "@/components/cabinet/section";
import { FARMER_REQUIREMENTS } from "@/lib/pilot-docs";

export const metadata: Metadata = { title: "Apply for financing", description: "Raise working capital against part of next season's harvest." };

const STEPS = [
  { title: "Sign up", body: "Sign up with your email. Your company gets a secure wallet; it becomes the issuer of record of its pool." },
  { title: "Company profile and issuer KYC", body: "Legal details and the KYC file. Compliance reviews them once." },
  { title: "Application with documents and fields", body: "Crop, volume, the share to finance and the amount; one document per item in What you need; field boundaries from your GeoJSON or KML export." },
  { title: "Review, verification and terms", body: "F2F reviews the documents, the SCAS partner verifies the fields by satellite, and the arranger builds the term sheet with you." },
  { title: "Investors subscribe, you receive the proceeds", body: "Once the pool is funded, the proceeds arrive in your wallet, net of the arrangement fee. At maturity you buy back or deliver grain." },
];

/** The farmer door (ADR 0018): what F2F finances, what it needs, how long it takes, then "Apply for financing". */
export default function ApplyPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 py-6">
      <header className="flex max-w-3xl flex-col items-start gap-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">For farmers</p>
        <h1 className="text-2xl font-semibold sm:text-[40px] sm:leading-[1.15]">Raise working capital against next season&apos;s harvest</h1>
        <p className="max-w-prose text-muted-foreground">
          Finance up to 30% of your expected harvest before you sow. Your verified fields become an instrument that investors buy with USDC; you repay at maturity in cash or in grain delivered to the elevator.
        </p>
        <Link href="/apply/start" className={primaryLink}>
          Apply for financing
        </Link>
      </header>

      <div className="grid gap-10 lg:grid-cols-2 [&>*]:min-w-0">
        <section aria-labelledby="needs" className="flex flex-col gap-4">
          <h2 id="needs" className="text-xl font-semibold">
            What you need
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {FARMER_REQUIREMENTS.map((r) => (
              <li key={r.key} className="flex items-start gap-3 p-4 text-sm">
                <CheckCircle2 aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {r.label}
              </li>
            ))}
            <li className="flex items-start gap-3 p-4 text-sm">
              <CheckCircle2 aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              Company registration and director identity for issuer KYC
            </li>
          </ul>
        </section>

        <section aria-labelledby="steps" className="flex flex-col gap-4">
          <h2 id="steps" className="text-xl font-semibold">
            How it works
          </h2>
          <ol className="flex flex-col gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-sm font-medium">{i + 1}</span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <p className="max-w-prose border-s-2 border-border ps-4 text-sm text-muted-foreground">
        This is a devnet pilot: proceeds are paid in test USDC. Your company data stays off-chain; only hashes, attestations and money movements are recorded on Solana.
      </p>
    </div>
  );
}

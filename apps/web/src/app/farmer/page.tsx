import type { Metadata } from "next";
import { FarmerApp, type FarmerFees } from "@/components/farmer/farmer-app";
import { getReader } from "@/lib/server/context";

export const metadata: Metadata = { title: "For farmers" };
export const dynamic = "force-dynamic";

export default async function FarmerPage() {
  // ADR 0013: the mint fee is disclosed before signing. A read failure hides the fee line; the program still charges it.
  const fc = await getReader()
    .fees()
    .catch(() => null);
  const fees: FarmerFees = fc ? { mintFee: fc.mintFee, maxArrangementBps: fc.maxArrangementBps } : null;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Finance your next season</h1>
        <p className="max-w-2xl text-muted-foreground">
          Upload your field boundaries and request working capital against 30% of your expected harvest. An independent verifier checks the fields before a pool is offered to investors.
        </p>
      </header>
      <FarmerApp fees={fees} />
    </div>
  );
}

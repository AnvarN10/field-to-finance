import type { Metadata } from "next";
import Link from "next/link";
import { ARRANGER_TABS } from "@/components/arranger/tabs";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { Section, textLink } from "@/components/cabinet/section";
import { InvestorCard } from "@/components/compliance/investor-card";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { investorQueue } from "@/lib/workflow/arranger";

export const metadata: Metadata = { title: "Investor KYC", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvestorKycPage() {
  const g = await guardCabinet("arranger", "/arranger/investors");
  if ("element" in g) return g.element;
  let pending, decided;
  try {
    const db = await getDb();
    [pending, decided] = await Promise.all([investorQueue(db, ["pending"]), investorQueue(db, ["approved", "rejected"])]);
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="The KYC queue could not be loaded. Try again in a minute." retryHref="/arranger/investors" />;
  }
  return (
    <CabinetShell role="Arranger" title="Investor KYC" email={g.user.email} tabs={ARRANGER_TABS}>
      <p className="max-w-prose text-sm text-muted-foreground">
        Compliance decides KYC and revocations in its own cabinet; this is a read view. You can act for compliance there.{" "}
        <Link href="/compliance/investors" className={textLink}>
          Open the compliance cabinet
        </Link>
      </p>
      <Section title="Waiting for a decision">
        {pending.length ? (
          <ul className="grid gap-4 xl:grid-cols-2">
            {pending.map((r) => (
              <InvestorCard key={r.userId} r={r} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No investor is waiting.</p>
        )}
      </Section>
      <Section title="Decided">
        {decided.length ? (
          <ul className="grid gap-4 xl:grid-cols-2">
            {decided.slice(0, 20).map((r) => (
              <InvestorCard key={r.userId} r={r} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No decisions yet.</p>
        )}
      </Section>
    </CabinetShell>
  );
}

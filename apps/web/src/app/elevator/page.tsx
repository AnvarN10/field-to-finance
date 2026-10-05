import { effectiveElection, PILOT_QUALITY_SPEC, type QualitySpec } from "@f2f/sdk";
import type { Metadata } from "next";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardServiceCabinet } from "@/components/cabinet/guard";
import { Section } from "@/components/cabinet/section";
import { LabForm } from "@/components/elevator/lab-form";
import { ReceiptForm } from "@/components/elevator/receipt-form";
import { ErrorState } from "@/components/state";
import { formatDateUtc, formatTonnes } from "@/lib/format";
import { getReader, getStore } from "@/lib/server/context";
import { evidenceKey, readHashed } from "@/lib/store";

export const metadata: Metadata = { title: "Elevator and laboratory", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = [{ href: "/elevator", label: "Delivery documents" }];

export default async function ElevatorHome() {
  const g = await guardServiceCabinet(["elevator", "lab"], "/elevator");
  if ("element" in g) return g.element;
  const now = Math.floor(Date.now() / 1000);
  let pools;
  try {
    pools = (await getReader().listPools()).filter((p) => p.terms && p.terms.settlementMode !== "CashBuyback" && p.status === "Funded");
  } catch {
    return <ErrorState level={1} title="Could not load the pools" body="Solana devnet did not answer." retryHref="/elevator" />;
  }
  const specs = new Map<string, QualitySpec>();
  for (const p of pools) {
    const h = p.terms?.qualitySpecHash;
    const bytes = h ? await readHashed(getStore(), evidenceKey(h), h).catch(() => null) : null;
    specs.set(p.poolId, bytes ? (JSON.parse(new TextDecoder().decode(bytes)) as QualitySpec) : PILOT_QUALITY_SPEC);
  }
  const isElevator = g.roles.includes("elevator");
  const isLab = g.roles.includes("lab");
  const title = isElevator && isLab ? "Elevator and laboratory" : isLab ? "Laboratory" : "Elevator";
  return (
    <CabinetShell role={title} title="Delivery documents" email={g.user.email} tabs={TABS}>
      <p className="max-w-prose text-sm text-muted-foreground">
        Pools on the delivery path. The elevator records what it received; the laboratory records the protocol against the pool&apos;s quality spec. Both go on-chain as delivery attestations; holders can claim grain once the receipt and a passing protocol are recorded after maturity.
      </p>
      {pools.length === 0 ? <p className="text-sm text-muted-foreground">No pool waits for delivery documents.</p> : null}
      {pools.map((p) => {
        const t = p.terms!;
        const blocker = effectiveElection(t, now, p.maturityTs) === "Buyback" ? "The issuer elected buyback: holders are paid in cash" : undefined;
        return (
          <Section key={p.poolId} title={`${p.instrument?.symbol ?? `POOL-${p.poolId}`} · pool ${p.poolId}`} description={`Matures ${formatDateUtc(p.maturityTs)}. Tokenized volume ${formatTonnes((BigInt(t.volumeKg) * BigInt(t.tokenizedShareBps)) / 10_000n)}. Receipt ${t.receiptHash ? "recorded" : "missing"}; lab protocol ${t.labCertHash ? (t.labPassed ? "passed" : "did not pass") : "missing"}.`}>
            <div className="grid items-start gap-6 xl:grid-cols-2 [&>*]:min-w-0">
              {isElevator ? (
                <div className="rounded-lg border border-border bg-card p-6">
                  <ReceiptForm poolId={p.poolId} elevator={t.elevator} blocker={blocker} />
                </div>
              ) : null}
              {isLab ? (
                <div className="rounded-lg border border-border bg-card p-6">
                  <LabForm poolId={p.poolId} spec={specs.get(p.poolId) ?? PILOT_QUALITY_SPEC} blocker={blocker} />
                </div>
              ) : null}
            </div>
          </Section>
        );
      })}
    </CabinetShell>
  );
}

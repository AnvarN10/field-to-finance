import { effectiveElection, PILOT_QUALITY_SPEC, type QualitySpec } from "@f2f/sdk";
import type { Metadata } from "next";
import Link from "next/link";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { Section } from "@/components/cabinet/section";
import { LabForm } from "@/components/elevator/lab-form";
import { ReceiptForm } from "@/components/elevator/receipt-form";
import { ErrorState } from "@/components/state";
import { formatDateUtc, formatTonnes } from "@/lib/format";
import { getReader, getStore } from "@/lib/server/context";
import { evidenceKey, readHashed } from "@/lib/store";

export const metadata: Metadata = { title: "Delivery" };
export const dynamic = "force-dynamic";

export default async function ElevatorHome({ searchParams }: { searchParams: Promise<{ pool?: string }> }) {
  const g = await guardConsole(["delivery.receipt", "delivery.lab"], "/console/delivery");
  if ("element" in g) return g.element;
  const now = Math.floor(Date.now() / 1000);
  let pools;
  try {
    pools = (await getReader().listPools()).filter((p) => p.terms && p.terms.settlementMode !== "CashBuyback" && p.status === "Funded" && effectiveElection(p.terms, now, p.maturityTs) !== "Buyback");
  } catch {
    return <ErrorState level={1} title="Could not load the pools" body="Solana devnet did not answer." retryHref="/console/delivery" />;
  }
  const isElevator = g.permissions.has("delivery.receipt");
  const isLab = g.permissions.has("delivery.lab");
  const title = isElevator && isLab ? "Delivery documents" : isLab ? "Lab protocols" : "Elevator receipts";
  // Waiting for this member's document: the receipt for the elevator, a passing protocol for the laboratory.
  const waiting = (p: (typeof pools)[number]) => (isElevator && !p.terms!.receiptHash) || (isLab && !p.terms!.labPassed);
  const requested = (await searchParams).pool;
  const selected = pools.find((p) => p.poolId === requested) ?? pools.find(waiting) ?? null;
  let spec: QualitySpec = PILOT_QUALITY_SPEC;
  const h = selected?.terms?.qualitySpecHash;
  const bytes = h ? await readHashed(getStore(), evidenceKey(h), h).catch(() => null) : null;
  if (bytes) spec = JSON.parse(new TextDecoder().decode(bytes)) as QualitySpec;
  const quiet = "text-muted-foreground [@media(hover:hover)]:group-hover:text-foreground";
  const state = (done: boolean, label: string) => <span className={done ? "text-success" : quiet}>{`${label} ${done ? "recorded" : "missing"}`}</span>;
  return (
    <ConsolePage title={title}>
      <p className="max-w-prose text-sm text-muted-foreground">
        Pools on the delivery path. The elevator records what it received; the laboratory records the protocol against the pool&apos;s quality spec. Holders can claim grain once the receipt and a passing protocol are recorded after maturity.
      </p>
      {pools.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pool waits for delivery documents.</p>
      ) : (
        <ul aria-label="Pools on the delivery path" className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {pools.map((p) => {
            const t = p.terms!;
            const current = selected?.poolId === p.poolId;
            return (
              <li key={p.poolId}>
                <Link
                  href={`/console/delivery?pool=${p.poolId}`}
                  aria-current={current ? "true" : undefined}
                  className={`group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-s-2 p-4 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-hover ${current ? "border-foreground" : "border-transparent"}`}
                >
                  <span className="font-medium">{`${p.instrument?.symbol ?? `POOL-${p.poolId}`} · pool ${p.poolId}`}</span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    {state(Boolean(t.receiptHash), "Receipt")}
                    <span className={t.labPassed ? "text-success" : t.labCertHash ? "text-destructive" : quiet}>{t.labPassed ? "Protocol passed" : t.labCertHash ? "Protocol did not pass" : "Protocol missing"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {selected ? (
        <Section title={`${selected.instrument?.symbol ?? `POOL-${selected.poolId}`} · pool ${selected.poolId}`} description={`Matures ${formatDateUtc(selected.maturityTs)}. Tokenized volume ${formatTonnes((BigInt(selected.terms!.volumeKg) * BigInt(selected.terms!.tokenizedShareBps)) / 10_000n)}.`}>
          <div className="grid items-start gap-6 xl:grid-cols-2 [&>*]:min-w-0">
            {isElevator ? (
              <div className="rounded-lg border border-border bg-card p-6">
                <ReceiptForm poolId={selected.poolId} elevator={selected.terms!.elevator} />
              </div>
            ) : null}
            {isLab ? (
              <div className="rounded-lg border border-border bg-card p-6">
                <LabForm poolId={selected.poolId} spec={spec} secondary={isElevator} />
              </div>
            ) : null}
          </div>
        </Section>
      ) : pools.length ? (
        <p className="text-sm text-muted-foreground">Every pool has its documents. Open a pool above to record a corrected one.</p>
      ) : null}
    </ConsolePage>
  );
}

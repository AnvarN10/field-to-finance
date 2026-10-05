import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardServiceCabinet } from "@/components/cabinet/guard";
import { Panel, Section, textLink } from "@/components/cabinet/section";
import { SeasonTimeline } from "@/components/pool/season-timeline";
import { AttestForm } from "@/components/scas/attest-form";
import { SCAS_TABS } from "@/components/scas/tabs";
import { ErrorState } from "@/components/state";
import { seasonAttestationBlocker } from "@/lib/pool-math";
import { getReader } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";

export const metadata: Metadata = { title: "Season", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ScasPool({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const g = await guardServiceCabinet(["scas"], `/scas/pools/${poolId}`);
  if ("element" in g) return g.element;
  let detail, attestations;
  try {
    detail = await getReader().getPool(poolId);
    attestations = detail ? await getReader().poolAttestations(poolId) : [];
  } catch {
    return <ErrorState level={1} title="Could not load this pool" body="Solana devnet did not answer." retryHref={`/scas/pools/${poolId}`} />;
  }
  if (!detail) notFound();
  const fieldCount = detail.projects.reduce((n, p) => n + p.fields.length, 0);
  const symbol = detail.pool.instrument?.symbol ?? `POOL-${poolId}`;
  return (
    <CabinetShell role="SCAS partner" title={`${symbol} season`} email={g.user.email} tabs={SCAS_TABS}>
      <Link href="/scas" className={`${textLink} -mt-4 self-start text-sm`}>
        Back to the queue
      </Link>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr] [&>*]:min-w-0">
        <Panel>
          <AttestForm poolId={poolId} blocker={seasonAttestationBlocker(detail.pool.status, detail.projects.length)} />
        </Panel>
        <Section title="Season timeline" description={`${fieldCount} fields in this pool.`}>
          <SeasonTimeline attestations={attestations} fieldCount={fieldCount} cluster={serverEnv().SOLANA_CLUSTER} />
        </Section>
      </div>
    </CabinetShell>
  );
}

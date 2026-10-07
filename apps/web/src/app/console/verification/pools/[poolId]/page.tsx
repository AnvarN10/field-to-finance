import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { Panel, Section, textLink } from "@/components/cabinet/section";
import { SeasonTimeline } from "@/components/pool/season-timeline";
import { AttestForm } from "@/components/scas/attest-form";
import { ErrorState } from "@/components/state";
import { seasonAttestationBlocker } from "@/lib/pool-math";
import { getReader } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";

export const metadata: Metadata = { title: "Season" };
export const dynamic = "force-dynamic";

export default async function ScasPool({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const g = await guardConsole("verification.attest", `/console/verification/pools/${poolId}`);
  if ("element" in g) return g.element;
  let detail, attestations;
  try {
    detail = await getReader().getPool(poolId);
    attestations = detail ? await getReader().poolAttestations(poolId) : [];
  } catch {
    return <ErrorState level={1} title="Could not load this pool" body="Solana devnet did not answer." retryHref={`/console/verification/pools/${poolId}`} />;
  }
  if (!detail) notFound();
  const fieldCount = detail.projects.reduce((n, p) => n + p.fields.length, 0);
  const symbol = detail.pool.instrument?.symbol ?? `POOL-${poolId}`;
  return (
    <ConsolePage title={`${symbol} season`}>
      <Link href="/console/verification" className={`${textLink} -mt-4 self-start text-sm`}>
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
    </ConsolePage>
  );
}

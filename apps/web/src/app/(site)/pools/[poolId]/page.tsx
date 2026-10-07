import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstrumentCard } from "@/components/pool/instrument-card";
import { HarvestBlock } from "@/components/pool/harvest-block";
import { InvestPanel } from "@/components/pool/invest-panel";
import { SeasonTimeline } from "@/components/pool/season-timeline";
import { settlementStatus } from "@/lib/instrument-terms";
import { deliveryRecords } from "@/lib/season-data";
import { ErrorState } from "@/components/state";
import { getReader, getStore } from "@/lib/server/context";
import { termSheetData } from "@/lib/server/term-sheet-data";
import { serverEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ poolId: string }> }): Promise<Metadata> {
  const { poolId } = await params;
  return { title: `Pool ${poolId}` };
}

export default async function PoolPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  let detail;
  let fees;
  try {
    [detail, fees] = await Promise.all([getReader().getPool(poolId), getReader().fees()]);
  } catch {
    return <ErrorState level={1} title="Could not load this pool" body="Solana devnet did not answer." retryHref={`/pools/${poolId}`} />;
  }
  if (!detail) notFound();
  const { spec, requirements } = detail.terms ? await Promise.resolve().then(() => termSheetData(getStore(), detail)).catch(() => ({ spec: null, requirements: null })) : { spec: null, requirements: null };
  const symbol = detail.pool.instrument?.symbol ?? `POOL-${poolId}`;
  const fieldCount = detail.projects.reduce((n, p) => n + p.fields.length, 0);
  // Season and harvest degrade to nothing when devnet or the bucket does not answer; the term sheet still renders.
  const [attestations, delivery] = await Promise.all([
    fieldCount && detail.pool.status !== "Draft" ? getReader().poolAttestations(poolId).catch(() => null) : Promise.resolve(null),
    deliveryRecords(getStore(), detail.terms).catch(() => ({ receipt: null, quality: null })),
  ]);
  const now = Math.floor(Date.now() / 1000);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Pool {poolId}</p>
        <h1 className="text-2xl font-semibold">{symbol}</h1>
        <p className="text-muted-foreground">{detail.pool.instrument?.name}</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* DOM order matches the phone order (panel first); on lg the grid places the panel in the right column. */}
        <aside id="invest" className="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1">
          <InvestPanel pool={detail.pool} networkFee={fees?.networkFee ?? null} />
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <InstrumentCard detail={detail} cluster={serverEnv().SOLANA_CLUSTER} networkFee={fees?.networkFee ?? null} spec={spec} requirements={requirements} />
          {attestations ? (
            <section aria-labelledby="season-title" className="mt-8 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 id="season-title" className="text-xl font-semibold">
                  Season
                </h2>
                <p className="text-sm text-muted-foreground">{`Satellite and field checks by the SCAS partner across ${fieldCount} fields.${detail.terms ? ` ${settlementStatus(detail.pool, detail.terms, now).label.replace(/\.$/, "")}.` : ""}`}</p>
              </div>
              <SeasonTimeline attestations={attestations} fieldCount={fieldCount} cluster={serverEnv().SOLANA_CLUSTER} />
            </section>
          ) : null}
          {detail.terms && (delivery.receipt || delivery.quality) ? (
            <section aria-labelledby="harvest-title" className="mt-8 flex flex-col gap-4">
              <h2 id="harvest-title" className="text-xl font-semibold">
                Harvest and quality
              </h2>
              <HarvestBlock elevator={detail.terms.elevator} lab={detail.terms.lab} receipt={delivery.receipt} quality={delivery.quality} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

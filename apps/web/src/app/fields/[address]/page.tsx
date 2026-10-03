import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplorerLink } from "@/components/explorer-link";
import { AttestationTimeline } from "@/components/field/attestation-timeline";
import { FieldMapLoader } from "@/components/field/field-map-loader";
import { EmptyState, ErrorState } from "@/components/state";
import { formatHa, formatTonnes } from "@/lib/format";
import { loadPolygon } from "@/lib/polygons";
import { getReader, getStore } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Field" };

export default async function FieldPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  let detail;
  try {
    detail = await getReader().getField(address);
  } catch {
    return <ErrorState title="Could not load this field" body="Solana devnet did not answer." retryHref={`/fields/${address}`} />;
  }
  if (!detail) notFound();
  const polygon = await loadPolygon(getStore(), detail.field.polygonHash).catch(() => null);
  const cluster = serverEnv().SOLANA_CLUSTER;
  const { field, project, pool } = detail;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {pool ? <Link href={`/pools/${pool.poolId}`} className="underline underline-offset-4">{pool.instrument?.symbol ?? `Pool ${pool.poolId}`}</Link> : "Not in a pool yet"}
        </p>
        <h1 className="text-2xl font-semibold">Field {field.index + 1}</h1>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        {polygon ? (
          <FieldMapLoader polygons={[polygon]} />
        ) : (
          <EmptyState title="Boundary file not found" body={`No stored polygon matches hash ${field.polygonHash.slice(0, 12)}…. The on-chain record is still valid.`} />
        )}
        <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-6 text-sm">
          <dt className="text-muted-foreground">Area</dt>
          <dd>{formatHa(field.areaHaX100)}</dd>
          <dt className="text-muted-foreground">Crop</dt>
          <dd>
            <span className="capitalize">{project.crop}</span>, season {project.season}
          </dd>
          <dt className="text-muted-foreground">Project expected harvest</dt>
          <dd>{formatTonnes(project.expectedKg)}</dd>
          <dt className="text-muted-foreground">Verified</dt>
          <dd>{field.verified ? "Yes" : "Not yet"}</dd>
          <dt className="text-muted-foreground">Polygon hash</dt>
          <dd className="font-mono text-[13px] break-all">{field.polygonHash}</dd>
          <dt className="text-muted-foreground">Field account</dt>
          <dd><ExplorerLink kind="address" value={field.address} cluster={cluster} /></dd>
        </dl>
      </div>
      <AttestationTimeline attestations={detail.attestations} cluster={cluster} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { ApplicationStatusBadge } from "@/components/cabinet/badges";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardServiceCabinet } from "@/components/cabinet/guard";
import { Section, textLink } from "@/components/cabinet/section";
import { FieldMapLoader } from "@/components/field/field-map-loader";
import { ScasStubBadge } from "@/components/scas-stub-badge";
import { SCAS_TABS } from "@/components/scas/tabs";
import { ErrorState } from "@/components/state";
import { formatHa } from "@/lib/format";
import { loadPolygon } from "@/lib/polygons";
import { arrangerChain } from "@/lib/server/chain-port";
import { getStore } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { scasPools, scasQueue } from "@/lib/workflow/scas";
import { verifyFieldsAction } from "./actions";

export const metadata: Metadata = { title: "SCAS partner cabinet", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ScasHome() {
  const g = await guardServiceCabinet(["scas"], "/scas");
  if ("element" in g) return g.element;
  let queue, pools;
  try {
    const db = await getDb();
    [queue, pools] = await Promise.all([scasQueue(db), scasPools(db)]);
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="The verification queue could not be loaded. Try again in a minute." retryHref="/scas" />;
  }
  const chain = arrangerChain();
  const store = getStore();
  // Sequential: the public devnet RPC rate-limits bursts of reads.
  const items = [];
  for (const app of queue) {
    const project = app.projectAddress ? await chain.project(app.projectAddress).catch(() => null) : null;
    const polygons = project ? (await Promise.all(project.fields.map((f) => loadPolygon(store, f.polygonHash).catch(() => null)))).filter((p) => p !== null) : [];
    items.push({ app, project, polygons });
  }
  return (
    <CabinetShell role="SCAS partner" title="Verification and season" email={g.user.email} tabs={SCAS_TABS}>
      <Section title="Fields waiting for verification" description="Check each boundary against the imagery, then verify. Verification writes a FieldVerified attestation per field, signed by the SCAS key." action={<ScasStubBadge />}>
        {items.length ? (
          <ul className="flex flex-col gap-4">
            {items.map(({ app, project, polygons }, i) => {
              const verified = Boolean(project && project.fieldCount > 0 && project.verifiedFieldCount === project.fieldCount);
              return (
                <li key={app.id} className="grid gap-6 rounded-lg border border-border bg-card p-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
                  {polygons.length ? <FieldMapLoader polygons={polygons} height={280} bare /> : <p className="text-sm text-muted-foreground">No stored boundary for these fields.</p>}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-base font-semibold capitalize">{`${app.crop} ${app.season}`}</h3>
                    {project ? (
                      <ul className="tabular flex flex-col divide-y divide-border text-sm">
                        {project.fields.map((f) => (
                          <li key={f.address} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
                            <span>{`Field ${f.index + 1} · ${formatHa(f.areaHaX100)}`}</span>
                            <span className="flex items-baseline gap-3">
                              <span className={f.verified ? "text-success" : "text-muted-foreground"}>{f.verified ? "Verified" : "Not verified"}</span>
                              <Link href={`/fields/${f.address}`} className={textLink}>
                                Open
                              </Link>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-destructive">The farm project was not found on-chain.</p>
                    )}
                    <ActionButton label="Verify fields" role="SCAS" variant={i === 0 ? "default" : "outline"} action={verifyFieldsAction.bind(null, app.id)} disabled={verified || !project} disabledReason={verified ? "Every field is verified" : !project ? "No on-chain project" : undefined} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to verify. Applications arrive here after issuer KYC.</p>
        )}
      </Section>
      <Section title="Pools in season" description="Record sowing, vegetation and the pre-harvest yield estimate for each funded pool.">
        {pools.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {pools.map((p) => (
              <li key={p.poolId}>
                <Link href={`/scas/pools/${p.poolId}`} className="flex flex-wrap items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-hover">
                  <span className="font-medium capitalize">{`Pool ${p.poolId} · ${p.crop} ${p.season}`}</span>
                  <ApplicationStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No funded pool yet.</p>
        )}
      </Section>
    </CabinetShell>
  );
}

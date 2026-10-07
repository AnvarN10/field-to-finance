import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-button";
import { CreatePoolForm } from "@/components/admin/create-pool-form";
import { FieldImport } from "@/components/admin/field-import";
import { OnboardingPanel } from "@/components/admin/onboarding-panel";
import { KeyAlerts } from "@/components/arranger/key-alerts";
import { LifecycleBoard } from "@/components/arranger/lifecycle-board";
import { PoolStatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { lifecycle } from "@/lib/lifecycle";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { Section } from "@/components/cabinet/section";
import { ExplorerLink } from "@/components/explorer-link";
import { ScasStubBadge } from "@/components/scas-stub-badge";
import { EmptyState, ErrorState } from "@/components/state";
import { nextPoolId } from "@/lib/chain/admin-ops";
import { formatHa } from "@/lib/format";
import { consoleData } from "@/lib/server/console-data";
import { verifyAllFieldsAction } from "@/app/console/_actions/pools";

export const metadata: Metadata = { title: "Live pools" };
export const dynamic = "force-dynamic";

export default async function LivePools() {
  const g = await guardConsole("pools.view", "/console/pools");
  if ("element" in g) return g.element;
  let data;
  try {
    data = await consoleData();
  } catch {
    return <ErrorState level={1} title="Could not load devnet state" body="Solana devnet did not answer." retryHref="/console/pools" />;
  }
  const unverified = data.unpooled.flatMap((p) => p.fields.filter((f) => !f.verified));
  const now = Math.floor(Date.now() / 1000);
  return (
    <ConsolePage title="Live pools">
      <KeyAlerts keyProblems={data.keyProblems} mismatches={data.mismatches} />
      <p className="max-w-prose text-sm text-muted-foreground">Every pool on devnet with its current phase, who acts next and your button when the step is yours. Open a pool for its details and the manual tools. New pools come from the application&apos;s term builder.</p>

      {data.details.length === 0 ? (
        <EmptyState title="No pools yet" body="Structure an application or create a pool below." />
      ) : (
        <ul className="flex flex-col gap-4">
          {data.details.map((d) => (
            <li key={d.pool.address} id={`pool-${d.pool.poolId}`} className="flex scroll-mt-20 flex-col gap-4 rounded-lg border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">
                  <Link href={`/console/pools/${d.pool.poolId}`} className="rounded-sm underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current">
                    {`${d.pool.instrument?.symbol ?? "Pool"} · #${d.pool.poolId}`}
                  </Link>
                </h2>
                <PoolStatusBadge status={d.pool.status} />
              </div>
              <LifecycleBoard poolId={d.pool.poolId} phases={lifecycle(d, now, data.vaults.get(d.pool.poolId))} compact canAct={g.permissions.has("pools.operate")} />
            </li>
          ))}
        </ul>
      )}

      {g.permissions.has("pools.structure") ? (
      <details className="group rounded-lg border border-border bg-card p-6">
        <summary className="cursor-pointer text-base font-semibold select-none">Manual pilot tools</summary>
        <div className="mt-6 flex flex-col gap-10">
          <Section title="Field verification" action={<ScasStubBadge />}>
            {unverified.length ? (
              <ul className="tabular text-sm text-muted-foreground">
                {unverified.map((f) => (
                  <li key={f.address} className="flex flex-wrap items-center gap-2">
                    {`Field ${f.index + 1}, ${formatHa(f.areaHaX100)}, project`} <ExplorerLink kind="address" value={f.project} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Every field of every project waiting for a pool is verified.</p>
            )}
            <ActionButton label="Verify all fields" role="SCAS stub" action={verifyAllFieldsAction} disabled={unverified.length === 0} disabledReason={unverified.length === 0 ? "Nothing to verify" : undefined} />
          </Section>
          <Section title="Create a pool">
            <CreatePoolForm defaultPoolId={nextPoolId(data.pools.map((p) => p.poolId))} maxArrangementBps={data.fees?.maxArrangementBps ?? null} farmers={data.farmers} />
          </Section>
          <Section title="Farmer onboarding by wallet" description="The legacy checklist keyed by wallet. Cabinet applications keep their own documents.">
            <OnboardingPanel />
          </Section>
          <Section title="Field import" description="Upload the farm's boundary export. MultiPolygons become one field each; check each polygon against the area in the land-use act.">
            <FieldImport />
          </Section>
        </div>
      </details>
      ) : null}
    </ConsolePage>
  );
}

import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-button";
import { CreatePoolForm } from "@/components/admin/create-pool-form";
import { FieldImport } from "@/components/admin/field-import";
import { OnboardingPanel } from "@/components/admin/onboarding-panel";
import { PoolConsole } from "@/components/admin/pool-console";
import { KeyAlerts } from "@/components/arranger/key-alerts";
import { ARRANGER_TABS } from "@/components/arranger/tabs";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { Section } from "@/components/cabinet/section";
import { ExplorerLink } from "@/components/explorer-link";
import { ScasStubBadge } from "@/components/scas-stub-badge";
import { EmptyState, ErrorState } from "@/components/state";
import { nextPoolId } from "@/lib/chain/admin-ops";
import { formatHa } from "@/lib/format";
import { consoleData } from "@/lib/server/console-data";
import { verifyAllFieldsAction } from "../actions";

export const metadata: Metadata = { title: "Live pools", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LivePools() {
  const g = await guardCabinet("arranger", "/arranger/pools");
  if ("element" in g) return g.element;
  let data;
  try {
    data = await consoleData();
  } catch {
    return <ErrorState level={1} title="Could not load devnet state" body="Solana devnet did not answer." retryHref="/arranger/pools" />;
  }
  const unverified = data.unpooled.flatMap((p) => p.fields.filter((f) => !f.verified));
  const now = Math.floor(Date.now() / 1000);
  return (
    <CabinetShell role="Arranger" title="Live pools" email={g.user.email} tabs={ARRANGER_TABS}>
      <KeyAlerts keyProblems={data.keyProblems} mismatches={data.mismatches} />
      <p className="max-w-prose text-sm text-muted-foreground">Raised, vault, maturity, election, delivery documents and settlement actions for every pool on devnet. New pools from applications are created in the application&apos;s term builder; the forms below stay for manual pilot work.</p>

      {data.details.length === 0 ? (
        <EmptyState title="No pools yet" body="Structure an application or create a pool below." />
      ) : (
        data.details.map((d) => (
          <div key={d.pool.address} id={`pool-${d.pool.poolId}`} className="scroll-mt-20">
            <PoolConsole detail={d} unpooled={data.unpooled} now={now} />
          </div>
        ))
      )}

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
    </CabinetShell>
  );
}

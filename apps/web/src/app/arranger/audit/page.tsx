import type { Metadata } from "next";
import { AuditTable } from "@/components/arranger/audit-table";
import { ARRANGER_TABS } from "@/components/arranger/tabs";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { ErrorState } from "@/components/state";
import { auditViews } from "@/lib/server/audit-view";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { listAudit } from "@/lib/workflow/audit";

export const metadata: Metadata = { title: "Audit log", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const g = await guardCabinet("arranger", "/arranger/audit");
  if ("element" in g) return g.element;
  let rows;
  try {
    const db = await getDb();
    rows = await auditViews(db, await listAudit(db, { limit: 200 }));
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="The audit log could not be loaded. Try again in a minute." retryHref="/arranger/audit" />;
  }
  return (
    <CabinetShell role="Arranger" title="Audit log" email={g.user.email} tabs={ARRANGER_TABS}>
      <p className="max-w-prose text-sm text-muted-foreground">Every decision and on-chain action, newest first, with its transaction. Failed attempts are kept with the error. The latest 200 entries.</p>
      <AuditTable rows={rows} cluster={serverEnv().SOLANA_CLUSTER} />
    </CabinetShell>
  );
}

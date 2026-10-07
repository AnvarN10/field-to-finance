import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationStatusBadge } from "@/components/cabinet/badges";
import { PageHeader } from "@/components/shell/page-header";
import { guardAccount } from "@/components/shell/account-guard";
import { Panel, Section, textLink } from "@/components/cabinet/section";
import { StatusTimeline } from "@/components/cabinet/status-timeline";
import { ExplorerLink } from "@/components/explorer-link";
import { ApplicationActions } from "@/components/farmer/application-actions";
import { DocumentChecklist } from "@/components/farmer/document-checklist";
import { FieldsSection } from "@/components/farmer/fields-section";
import { Obligations } from "@/components/farmer/obligations";
import { ErrorState } from "@/components/state";
import { canTransition } from "@/lib/application-status";
import { RequestError } from "@/lib/errors";
import { formatTonnes, formatUsd, formatYield, plural } from "@/lib/format";
import { arrangerChain } from "@/lib/server/chain-port";
import { poolObligation } from "@/lib/server/cabinet-data";
import { getReader } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { farmerChecklist, getOwnApplication } from "@/lib/workflow/farmer";
import { uploadDocumentAction } from "@/app/(app)/issuer/actions";
import Link from "next/link";

export const metadata: Metadata = { title: "Application" };
export const dynamic = "force-dynamic";

export default async function FarmerApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardAccount("farmer", `/issuer/applications/${id}`);
  if ("element" in g) return g.element;
  let app, checklist;
  try {
    const db = await getDb();
    app = await getOwnApplication(db, g.user, id);
    checklist = await farmerChecklist(db, id);
  } catch (e) {
    if (e instanceof RequestError && e.status === 404) notFound();
    return <ErrorState level={1} title="Your workspace is unavailable" body="This application could not be loaded. Try again in a minute." retryHref={`/issuer/applications/${id}`} />;
  }
  const now = Math.floor(Date.now() / 1000);
  const [project, fees, obligation] = await Promise.all([
    app.projectAddress ? arrangerChain().project(app.projectAddress).catch(() => null) : null,
    getReader().fees().catch(() => null),
    app.poolId ? poolObligation(app.poolId, now) : null,
  ]);
  const cluster = serverEnv().SOLANA_CLUSTER;
  const editable = app.status === "draft" ? "all" : app.status === "submitted" || app.status === "documents_review" ? "rejected-only" : "none";
  const usd = (whole: number) => formatUsd(BigInt(whole) * 1_000_000n);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title={`${app.crop[0]?.toUpperCase()}${app.crop.slice(1)} ${app.season}`} />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Status</h2>
          <ApplicationStatusBadge status={app.status} />
        </div>
        <StatusTimeline status={app.status} note={app.statusNote} viewer="farmer" />
        <ApplicationActions applicationId={app.id} canSubmit={app.status === "draft"} canWithdraw={canTransition(app.status, "withdrawn")} />
      </Panel>

      <Section title="Terms requested">
        <dl className="tabular grid gap-4 rounded-lg border border-border bg-card p-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Amount", usd(app.requestedUsd)],
            ["Proposed coupon", `${formatYield(app.proposedCouponBps)} a year, Act/360`],
            ["Volume", `${formatTonnes(BigInt(app.volumeT) * 1000n)}, grade ${app.grade}`],
            ["Tokenized share", formatYield(app.tokenizedShareBps)],
            ["Elevator", app.elevator],
            ["Laboratory", app.lab],
            ["Pool", app.poolId ? `#${app.poolId}` : "Not created yet"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {app.poolId && app.status !== "ready" ? (
          <Link href={`/pools/${app.poolId}`} className={`${textLink} self-start text-sm`}>
            View the public pool page
          </Link>
        ) : null}
      </Section>

      <Section title="Documents" description={editable === "none" ? "Documents are closed for this application." : "PDF, image, CSV, XLSX, DOCX or ZIP, up to 10 MB each. Only arrangers and you can open them."}>
        <Panel>
          <DocumentChecklist rows={checklist} editable={editable} upload={uploadDocumentAction.bind(null, app.id)} />
        </Panel>
      </Section>

      <Section title="Fields" description="Your field boundaries become on-chain fields that the verifier checks by satellite.">
        <Panel>
          {app.projectAddress ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                Registered as project <ExplorerLink kind="address" value={app.projectAddress} cluster={cluster} />
              </p>
              {project ? <p className="text-muted-foreground">{`${plural(project.fieldCount, "field")}, ${project.verifiedFieldCount} verified by the SCAS stub`}</p> : null}
            </div>
          ) : app.status === "draft" ? (
            <FieldsSection
              applicationId={app.id}
              application={{ crop: app.crop, season: app.season, volumeT: app.volumeT, requestedUsd: app.requestedUsd }}
              mintFee={fees?.mintFee ?? null}
              maxArrangementBps={fees?.maxArrangementBps ?? null}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No fields were registered.</p>
          )}
        </Panel>
      </Section>

      {obligation ? (
        <Section title="Obligations">
          <Obligations items={[obligation.item]} />
        </Section>
      ) : null}
    </div>
  );
}

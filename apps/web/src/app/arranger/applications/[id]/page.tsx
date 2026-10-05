import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { AuditTable } from "@/components/arranger/audit-table";
import { Decision } from "@/components/arranger/decision";
import { DocumentReview } from "@/components/arranger/document-review";
import { RejectApplication } from "@/components/arranger/reject-application";
import { ARRANGER_TABS } from "@/components/arranger/tabs";
import { TermBuilder } from "@/components/arranger/term-builder";
import { ApplicationStatusBadge, KycStatusBadge } from "@/components/cabinet/badges";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { Panel, Section, textLink } from "@/components/cabinet/section";
import { StatusTimeline } from "@/components/cabinet/status-timeline";
import { ExplorerLink } from "@/components/explorer-link";
import { ScasStubBadge } from "@/components/scas-stub-badge";
import { ErrorState } from "@/components/state";
import { canTransition, isChainDerived } from "@/lib/application-status";
import { RequestError } from "@/lib/errors";
import { formatHa, formatTonnes, formatUsd, formatYield } from "@/lib/format";
import { auditViews } from "@/lib/server/audit-view";
import { arrangerChain } from "@/lib/server/chain-port";
import { getReader } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { termDefaults } from "@/lib/term-defaults";
import { applicationDetail } from "@/lib/workflow/arranger";
import { advanceAction, decideFarmerKycAction, publishAction, verifyFieldsAction } from "../../workflow-actions";

export const metadata: Metadata = { title: "Application review", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ArrangerApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardCabinet("arranger", `/arranger/applications/${id}`);
  if ("element" in g) return g.element;
  let d, audit;
  try {
    const db = await getDb();
    d = await applicationDetail(db, id);
    audit = await auditViews(db, d.audit);
  } catch (e) {
    if (e instanceof RequestError && e.status === 404) notFound();
    return <ErrorState level={1} title="Your cabinet is unavailable" body="This application could not be loaded. Try again in a minute." retryHref={`/arranger/applications/${id}`} />;
  }
  const app = d.application;
  const cluster = serverEnv().SOLANA_CLUSTER;
  const [project, fees] = await Promise.all([app.projectAddress ? arrangerChain().project(app.projectAddress).catch(() => null) : null, getReader().fees().catch(() => null)]);
  const allAccepted = d.checklist.every((r) => r.status === "accepted");
  const kyc = d.profile?.kycStatus ?? "not_started";
  const verified = Boolean(project && project.fieldCount > 0 && project.verifiedFieldCount === project.fieldCount);
  const usd = (whole: number) => formatUsd(BigInt(whole) * 1_000_000n);

  return (
    <CabinetShell role="Arranger" title={`${d.profile?.legalName ?? d.farmer.email} · ${app.crop} ${app.season}`} email={g.user.email} tabs={ARRANGER_TABS}>
      <Link href="/arranger" className={`${textLink} -mt-4 self-start text-sm`}>
        Back to the pipeline
      </Link>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
        <div className="flex flex-col gap-6">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Status</h2>
              <ApplicationStatusBadge status={app.status} />
            </div>
            <StatusTimeline status={app.status} note={app.statusNote} viewer="arranger" />
          </Panel>

          <Panel>
            <h2 className="text-base font-semibold">Next step</h2>
            {app.status === "draft" ? <p className="text-sm text-muted-foreground">The farmer has not submitted yet.</p> : null}
            {app.status === "submitted" ? <ActionButton label="Start document review" role="Arranger" action={advanceAction.bind(null, app.id, "documents_review")} /> : null}
            {app.status === "documents_review" ? (
              <ActionButton
                label="Move to issuer KYC"
                role="Arranger"
                action={advanceAction.bind(null, app.id, "kyc")}
                disabled={!allAccepted}
                disabledReason={allAccepted ? undefined : "Accept every required document first"}
              />
            ) : null}
            {app.status === "kyc" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>Issuer KYC</span>
                  <KycStatusBadge status={kyc} />
                </div>
                {d.kycDocument ? (
                  <a href={`/api/documents/${d.kycDocument.sha256}`} className={`${textLink} self-start text-sm`}>
                    Download the KYC documents
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">The farmer has not uploaded KYC documents yet.</p>
                )}
                {kyc === "pending" ? (
                  <Decision
                    approveLabel="Approve issuer KYC"
                    approve={decideFarmerKycAction.bind(null, d.farmer.id, "approved", null)}
                    reject={decideFarmerKycAction.bind(null, d.farmer.id, "rejected")}
                    signedBy="Compliance"
                  />
                ) : null}
                <ActionButton
                  label="Move to field verification"
                  role="Arranger"
                  action={advanceAction.bind(null, app.id, "field_verification")}
                  disabled={kyc !== "approved"}
                  disabledReason={kyc !== "approved" ? "Approve the issuer's KYC first" : undefined}
                />
              </div>
            ) : null}
            {app.status === "field_verification" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <ScasStubBadge />
                </div>
                {project ? (
                  <ul className="tabular flex flex-col gap-1 text-sm">
                    {project.fields.map((f) => (
                      <li key={f.address} className="flex flex-wrap items-center gap-2">
                        {`Field ${f.index + 1}, ${formatHa(f.areaHaX100)}: ${f.verified ? "verified" : "not verified"}`}
                        <Link href={`/fields/${f.address}`} className={textLink}>
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-destructive">The farm project was not found on-chain.</p>
                )}
                <ActionButton label="Verify fields with the SCAS stub" role="SCAS stub" action={verifyFieldsAction.bind(null, app.id)} disabled={verified || !project} disabledReason={verified ? "Every field is verified" : undefined} />
                <ActionButton
                  label="Move to structuring"
                  role="Arranger"
                  action={advanceAction.bind(null, app.id, "structuring")}
                  disabled={!verified}
                  disabledReason={verified ? undefined : "Verify every field first"}
                />
              </div>
            ) : null}
            {app.status === "structuring" ? (
              <TermBuilder applicationId={app.id} requestedUsd={app.requestedUsd} defaults={termDefaults(app, fees?.maxArrangementBps ?? null)} maxArrangementBps={fees?.maxArrangementBps ?? null} />
            ) : null}
            {app.status === "ready" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{`Pool #${app.poolId} is a Draft with the term sheet and the farm project. Publishing opens it to investors.`}</p>
                <ActionButton label="Publish the pool" role="Issuer" action={publishAction.bind(null, app.id)} />
              </div>
            ) : null}
            {isChainDerived(app.status) ? (
              <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <Link href={`/arranger/pools#pool-${app.poolId}`} className={textLink}>
                  Settlement actions in Live pools
                </Link>
                <Link href={`/pools/${app.poolId}`} className={textLink}>
                  Public pool page
                </Link>
              </p>
            ) : null}
            {app.status === "rejected" || app.status === "withdrawn" ? <p className="text-sm text-muted-foreground">Nothing left to do.</p> : null}
            {canTransition(app.status, "rejected") ? <RejectApplication applicationId={app.id} /> : null}
          </Panel>

          <Section title="Documents">
            <Panel>
              <DocumentReview rows={d.checklist} reviewOpen={app.status === "documents_review"} />
            </Panel>
          </Section>

          <Section title="Activity">
            <AuditTable rows={audit} cluster={cluster} />
          </Section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-20">
          <Panel>
            <h2 className="text-base font-semibold">Issuer</h2>
            <dl className="flex flex-col gap-3 text-sm">
              {[
                ["Legal name", d.profile?.legalName ?? "Not provided"],
                ["BIN", d.profile?.bin ?? "Not provided"],
                ["Region", d.profile?.region ?? "Not provided"],
                ["Contact", d.profile?.contact ?? "Not provided"],
                ["Email", d.farmer.email],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Wallet</dt>
                <dd>{d.farmerWallets[0] ? <ExplorerLink kind="address" value={d.farmerWallets[0]} cluster={cluster} /> : "None yet"}</dd>
              </div>
            </dl>
          </Panel>
          <Panel>
            <h2 className="text-base font-semibold">Requested terms</h2>
            <dl className="tabular flex flex-col gap-3 text-sm">
              {[
                ["Amount", usd(app.requestedUsd)],
                ["Proposed coupon", `${formatYield(app.proposedCouponBps)} a year`],
                ["Volume", `${formatTonnes(BigInt(app.volumeT) * 1000n)}, grade ${app.grade}`],
                ["Tokenized share", formatYield(app.tokenizedShareBps)],
                ["Elevator", app.elevator],
                ["Laboratory", app.lab],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
              {app.projectAddress ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Project</dt>
                  <dd>
                    <ExplorerLink kind="address" value={app.projectAddress} cluster={cluster} />
                  </dd>
                </div>
              ) : null}
              {app.poolId ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Pool</dt>
                  <dd>{`#${app.poolId}`}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>
        </aside>
      </div>
    </CabinetShell>
  );
}

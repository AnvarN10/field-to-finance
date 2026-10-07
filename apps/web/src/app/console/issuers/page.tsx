import type { Metadata } from "next";
import { Decision } from "@/components/arranger/decision";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { Section, textLink } from "@/components/cabinet/section";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { complianceQueues } from "@/lib/workflow/compliance";
import { decideFarmerKycAction } from "@/app/console/_actions/kyc";

export const metadata: Metadata = { title: "Issuers" };
export const dynamic = "force-dynamic";

export default async function ComplianceHome() {
  const g = await guardConsole("issuers.view", "/console/issuers");
  if ("element" in g) return g.element;
  let q;
  try {
    q = await complianceQueues(await getDb());
  } catch {
    return <ErrorState level={1} title="This section is unavailable" body="The KYC queues could not be loaded. Try again in a minute." retryHref="/console/issuers" />;
  }
  return (
    <ConsolePage title="Issuer KYC">
      <Section title="Waiting for a decision" description="The farmer's company becomes the issuer of record. Approval writes the platform KYC record on-chain for its issuer wallet, signed by the compliance key.">
        {q.farmers.length ? (
          <ul className="grid gap-4 xl:grid-cols-2">
            {q.farmers.map((f) => (
              <li key={f.profile.userId} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
                <span className="font-medium break-all">{f.profile.legalName ?? f.email}</span>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {[
                    ["BIN", f.profile.bin ?? "Not given"],
                    ["Region", f.profile.region ?? "Not given"],
                    ["Contact", f.profile.contact ?? "Not given"],
                    ["Account", f.email],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className={k === "BIN" ? "tabular break-words" : "break-words"}>{v}</dd>
                    </div>
                  ))}
                </dl>
                {f.kycDocument ? (
                  <a href={`/api/documents/${f.kycDocument}`} className={`${textLink} self-start text-sm`}>
                    Download the KYC documents
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">No KYC documents uploaded.</p>
                )}
                <Decision approveLabel="Approve issuer KYC" approve={decideFarmerKycAction.bind(null, f.profile.userId, "approved", null)} reject={decideFarmerKycAction.bind(null, f.profile.userId, "rejected")} signedBy="the compliance key" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No issuer is waiting. Farmers submit KYC from their issuer workspace.</p>
        )}
      </Section>
    </ConsolePage>
  );
}

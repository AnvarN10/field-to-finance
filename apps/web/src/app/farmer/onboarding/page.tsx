import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { KycStatusBadge } from "@/components/cabinet/badges";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { FileUploadButton } from "@/components/cabinet/file-upload-button";
import { guardCabinet } from "@/components/cabinet/guard";
import { Panel, Section } from "@/components/cabinet/section";
import { ExplorerLink } from "@/components/explorer-link";
import { ProfileForm } from "@/components/farmer/profile-form";
import { FARMER_TABS } from "@/components/farmer/tabs";
import { ErrorState } from "@/components/state";
import { wallets } from "@/lib/db/schema";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { DOCUMENT_LABELS, REQUIRED_KINDS } from "@/lib/workflow/documents";
import { farmerKycDocument, farmerProfile, isProfileComplete } from "@/lib/workflow/farmer";
import { uploadKycAction } from "../actions";

export const metadata: Metadata = { title: "Company and KYC", robots: { index: false } };
export const dynamic = "force-dynamic";

const KYC_COPY = {
  not_started: "Upload the company charter and the director's ID as one PDF or ZIP. An arranger reviews it and records your approval on-chain.",
  pending: "An arranger is reviewing your documents. You can keep preparing your application meanwhile.",
  approved: "Your company passed issuer KYC. The approval is recorded on-chain for your wallet.",
  rejected: "Your KYC was rejected. Fix the issue below and upload the documents again.",
} as const;

export default async function FarmerOnboarding() {
  const g = await guardCabinet("farmer", "/farmer/onboarding");
  if ("element" in g) return g.element;
  let profile, kycDoc, wallet;
  try {
    const db = await getDb();
    [profile, kycDoc, wallet] = await Promise.all([
      farmerProfile(db, g.user.id),
      farmerKycDocument(db, g.user.id),
      db.query.wallets.findFirst({ where: and(eq(wallets.userId, g.user.id), eq(wallets.kind, "privy-embedded")) }),
    ]);
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="Your profile could not be loaded. Try again in a minute." retryHref="/farmer/onboarding" />;
  }
  const kyc = profile?.kycStatus ?? "not_started";
  const complete = isProfileComplete(profile);
  return (
    <CabinetShell role="Farmer issuer" title="Company and KYC" email={g.user.email} tabs={FARMER_TABS}>
      <Section id="profile" title="1. Company profile" description="Used for the term sheet and issuer KYC. Legal name and BIN stay in private storage and never go on-chain.">
        <Panel className="max-w-3xl">
          <ProfileForm initial={{ legalName: profile?.legalName ?? "", bin: profile?.bin ?? "", region: profile?.region ?? "", contact: profile?.contact ?? "" }} />
        </Panel>
      </Section>

      <Section id="kyc" title="2. Issuer KYC" action={<KycStatusBadge status={kyc} />}>
        <Panel className="max-w-3xl">
          <p className="text-sm text-muted-foreground">{KYC_COPY[kyc]}</p>
          {profile?.kycNote ? <p className="text-sm text-destructive">{profile.kycNote}</p> : null}
          {kycDoc ? <p className="font-mono text-xs text-muted-foreground">{`Uploaded ${kycDoc.sha256.slice(0, 8)}…${kycDoc.sha256.slice(-6)}`}</p> : null}
          {kyc === "approved" ? null : complete ? (
            <FileUploadButton label={kycDoc ? "Upload again" : "Upload KYC documents"} action={uploadKycAction} />
          ) : (
            <p className="text-sm text-muted-foreground">Save the company profile first.</p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">Your issuer wallet</span>
            {wallet ? <ExplorerLink kind="address" value={wallet.address} cluster={serverEnv().SOLANA_CLUSTER} /> : <span>being created by Privy; reload in a moment</span>}
          </div>
        </Panel>
      </Section>

      <Section id="checklist" title="3. Term sheet checklist" description="You upload these per application, together with your field boundaries. Each document is reviewed by an arranger.">
        <Panel className="max-w-3xl">
          <ol className="flex flex-col gap-2 text-sm">
            {REQUIRED_KINDS.map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="tabular w-5 shrink-0 text-muted-foreground">{i + 1}</span>
                {DOCUMENT_LABELS[k]}
              </li>
            ))}
          </ol>
        </Panel>
      </Section>
    </CabinetShell>
  );
}

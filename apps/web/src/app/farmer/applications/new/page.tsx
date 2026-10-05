import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { Panel } from "@/components/cabinet/section";
import { ApplicationForm } from "@/components/farmer/application-form";
import { FARMER_TABS } from "@/components/farmer/tabs";
import { getDb } from "@/lib/server/db";
import { farmerProfile, isProfileComplete } from "@/lib/workflow/farmer";

export const metadata: Metadata = { title: "New application", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewApplication() {
  const g = await guardCabinet("farmer", "/farmer/applications/new");
  if ("element" in g) return g.element;
  const complete = await getDb()
    .then((db) => farmerProfile(db, g.user.id))
    .then(isProfileComplete)
    .catch(() => false);
  if (!complete) redirect("/farmer/onboarding");
  return (
    <CabinetShell role="Farmer issuer" title="New application" email={g.user.email} tabs={FARMER_TABS}>
      <Panel className="max-w-3xl">
        <p className="text-sm text-muted-foreground">Describe the harvest you want to finance. Next you upload the term sheet documents and your field boundaries, then submit.</p>
        <ApplicationForm />
      </Panel>
    </CabinetShell>
  );
}

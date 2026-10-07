import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { guardAccount } from "@/components/shell/account-guard";
import { Panel } from "@/components/cabinet/section";
import { ApplicationForm } from "@/components/farmer/application-form";
import { getDb } from "@/lib/server/db";
import { farmerProfile, isProfileComplete } from "@/lib/workflow/farmer";

export const metadata: Metadata = { title: "New application" };
export const dynamic = "force-dynamic";

export default async function NewApplication() {
  const g = await guardAccount("farmer", "/issuer/applications/new");
  if ("element" in g) return g.element;
  const complete = await getDb()
    .then((db) => farmerProfile(db, g.user.id))
    .then(isProfileComplete)
    .catch(() => false);
  if (!complete) redirect("/issuer/company");
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="New application" />
      <Panel className="max-w-3xl">
        <p className="text-sm text-muted-foreground">Describe the harvest you want to finance. Next you upload the term sheet documents and your field boundaries, then submit.</p>
        <ApplicationForm />
      </Panel>
    </div>
  );
}

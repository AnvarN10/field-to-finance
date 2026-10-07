import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { guardAccount } from "@/components/shell/account-guard";
import { primaryLink, Section } from "@/components/cabinet/section";
import { ApplicationList } from "@/components/farmer/application-list";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { farmerApplications, farmerProfile, isProfileComplete } from "@/lib/workflow/farmer";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

export default async function FarmerApplications() {
  const g = await guardAccount("farmer", "/issuer/applications");
  if ("element" in g) return g.element;
  let apps, complete;
  try {
    const db = await getDb();
    [apps, complete] = await Promise.all([farmerApplications(db, g.user.id), farmerProfile(db, g.user.id).then(isProfileComplete)]);
  } catch {
    return <ErrorState level={1} title="Your workspace is unavailable" body="Your applications could not be loaded. Try again in a minute." retryHref="/issuer/applications" />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Applications" />
      <Section
        title="All applications"
        action={
          complete && apps.length ? (
            <Link href="/issuer/applications/new" className={primaryLink}>
              New application
            </Link>
          ) : undefined
        }
      >
        <ApplicationList applications={apps} canCreate={complete} />
      </Section>
    </div>
  );
}

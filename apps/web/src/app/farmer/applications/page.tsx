import type { Metadata } from "next";
import Link from "next/link";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { primaryLink, Section } from "@/components/cabinet/section";
import { ApplicationList } from "@/components/farmer/application-list";
import { FARMER_TABS } from "@/components/farmer/tabs";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { farmerApplications, farmerProfile, isProfileComplete } from "@/lib/workflow/farmer";

export const metadata: Metadata = { title: "Applications", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FarmerApplications() {
  const g = await guardCabinet("farmer", "/farmer/applications");
  if ("element" in g) return g.element;
  let apps, complete;
  try {
    const db = await getDb();
    [apps, complete] = await Promise.all([farmerApplications(db, g.user.id), farmerProfile(db, g.user.id).then(isProfileComplete)]);
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="Your applications could not be loaded. Try again in a minute." retryHref="/farmer/applications" />;
  }
  return (
    <CabinetShell role="Farmer issuer" title="Applications" email={g.user.email} tabs={FARMER_TABS}>
      <Section
        title="All applications"
        action={
          complete && apps.length ? (
            <Link href="/farmer/applications/new" className={primaryLink}>
              New application
            </Link>
          ) : undefined
        }
      >
        <ApplicationList applications={apps} canCreate={complete} />
      </Section>
    </CabinetShell>
  );
}

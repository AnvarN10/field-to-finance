import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationStatusBadge, KycStatusBadge } from "@/components/cabinet/badges";
import { Panel, primaryLink, Section, textLink } from "@/components/cabinet/section";
import { Updates } from "@/components/cabinet/updates";
import { ApplicationList } from "@/components/farmer/application-list";
import { guardAccount } from "@/components/shell/account-guard";
import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/state";
import { formatDateUtc, formatUsdDown } from "@/lib/format";
import { nextAction } from "@/lib/issuer-next-action";
import { getDb } from "@/lib/server/db";
import { issuerObligations } from "@/lib/server/issuer-data";
import { refreshStatuses } from "@/lib/server/status-refresh";
import { farmerApplications, farmerProfile, isProfileComplete } from "@/lib/workflow/farmer";
import { listNotifications } from "@/lib/workflow/notifications";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function IssuerOverview() {
  const g = await guardAccount("farmer", "/issuer");
  if ("element" in g) return g.element;
  const now = Math.floor(Date.now() / 1000);
  let data;
  try {
    const db = await getDb();
    await refreshStatuses(db);
    const [profile, apps, updates] = await Promise.all([farmerProfile(db, g.user.id), farmerApplications(db, g.user.id), listNotifications(db, g.user.id, 5)]);
    const { obligations } = await issuerObligations(db, g.user.id, apps, now);
    data = { profile, apps, updates, obligations };
  } catch {
    return <ErrorState level={1} title="Your workspace is unavailable" body="Your applications could not be loaded. Try again in a minute." retryHref="/issuer" />;
  }
  const complete = isProfileComplete(data.profile);
  const kyc = data.profile?.kycStatus ?? "not_started";
  const latest = data.apps[0] ?? null;
  const next = nextAction(complete, kyc, latest);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title="Overview" description={data.profile?.legalName ?? undefined} />
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Next step</p>
            <h2 className="text-base font-semibold">{next.title}</h2>
            <p className="text-sm text-muted-foreground">{next.owner === "you" ? "This step is yours." : `Waiting for: ${next.owner}. You get an update when it moves.`}</p>
          </div>
          {latest ? <ApplicationStatusBadge status={latest.status} /> : <KycStatusBadge status={kyc} />}
        </div>
        <Link href={next.href} className={next.owner === "you" ? `${primaryLink} self-start` : `${textLink} self-start text-sm`}>
          {next.label}
        </Link>
      </Panel>

      <Section
        title="Applications"
        action={
          complete && data.apps.length ? (
            <Link href="/issuer/applications/new" className={`${textLink} text-sm`}>
              New application
            </Link>
          ) : undefined
        }
      >
        <ApplicationList applications={data.apps.slice(0, 5)} canCreate={complete} />
        {data.apps.length > 5 ? (
          <Link href="/issuer/applications" className={`${textLink} self-start text-sm`}>
            {`All ${data.apps.length} applications`}
          </Link>
        ) : null}
      </Section>

      {data.obligations.length ? (
        <Section title="Obligations" action={<Link href="/issuer/obligations" className={`${textLink} text-sm`}>Open obligations</Link>}>
          <ul className="tabular flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {data.obligations.map((o) => (
              <li key={o.poolId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-medium">{`${o.symbol} · pool ${o.poolId}`}</span>
                <span>{`${formatUsdDown(o.dueAtMaturity)} due ${formatDateUtc(o.maturityTs)}`}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Updates">
        <Updates items={data.updates} />
      </Section>
    </div>
  );
}

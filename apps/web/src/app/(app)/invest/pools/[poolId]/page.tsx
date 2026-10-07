import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { guardAccount } from "@/components/shell/account-guard";
import { textLink } from "@/components/cabinet/section";
import { CabinetInvest } from "@/components/investor/cabinet-invest";
import { KfdAccept } from "@/components/investor/kfd-accept";
import { ErrorState } from "@/components/state";
import { formatDateUtc } from "@/lib/format";
import { buildKfd, kfdHash } from "@/lib/kfd";
import { getReader } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { hasKfd, investorOnboarding } from "@/lib/workflow/investor";

export const metadata: Metadata = { title: "Key features" };
export const dynamic = "force-dynamic";

export default async function KfdPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const g = await guardAccount("investor", `/invest/pools/${poolId}`);
  if ("element" in g) return g.element;
  let detail, fees;
  try {
    [detail, fees] = await Promise.all([getReader().getPool(poolId), getReader().fees().catch(() => null)]);
  } catch {
    return <ErrorState level={1} title="Could not load this pool" body="Solana devnet did not answer." retryHref={`/invest/pools/${poolId}`} />;
  }
  if (!detail) notFound();
  const kfd = buildKfd(detail, fees?.networkFee ?? null);
  const hash = kfdHash(kfd);
  let accepted, onboarding;
  try {
    const db = await getDb();
    [accepted, onboarding] = await Promise.all([hasKfd(db, g.user.id, detail.pool.address), investorOnboarding(db, g.user.id)]);
  } catch {
    return <ErrorState level={1} title="Your account is unavailable" body="Try again in a minute." retryHref={`/invest/pools/${poolId}`} />;
  }
  const current = accepted?.documentHash === hash;
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <PageHeader title={kfd.title} eyebrow="Key features document" />
      <article className="flex max-w-3xl flex-col gap-6 rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Read this before your first subscription to the pool. It sums up the term sheet; the full terms are on the pool page.</p>
        <dl className="flex flex-col divide-y divide-border text-sm">
          {kfd.items.map((i) => (
            <div key={i.label} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">{i.label}</dt>
              <dd className="tabular">{i.value}</dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="risks" className="flex flex-col gap-2">
          <h2 id="risks" className="text-base font-semibold">
            Main risks
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm text-muted-foreground">
            {kfd.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
        <p className="font-mono text-xs break-all text-muted-foreground">{`Document SHA-256 ${hash}`}</p>
        <div className="border-t border-border pt-4">
          {current ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-success">{`Accepted ${formatDateUtc(Math.floor(accepted!.acceptedAt.getTime() / 1000))}`}</span>
              <Link href={`/pools/${poolId}`} className={textLink}>
                Open the public pool page
              </Link>
            </div>
          ) : onboarding.kycStatus === "approved" && onboarding.riskAcknowledged ? (
            <>
              {accepted ? <p className="mb-3 text-sm text-muted-foreground">The terms changed since you last accepted. Read them again.</p> : null}
              <KfdAccept poolId={poolId} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Finish onboarding first: KYC approval and the risk acknowledgement.{" "}
              <Link href="/invest/account" className={textLink}>
                Go to onboarding
              </Link>
            </p>
          )}
        </div>
      </article>
      {/* Holders can always refund, redeem or claim; subscribing needs the current KFD (the server checks it too). */}
      {current || (detail.pool.status !== "Open" && onboarding.complete) ? (
        <div id="invest" className="max-w-md">
          <CabinetInvest pool={detail.pool} networkFee={fees?.networkFee ?? null} />
        </div>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { ExplorerLink } from "@/components/explorer-link";
import { DealPath } from "@/components/landing/deal-path";
import { HeroVisual } from "@/components/landing/hero-visual";
import { LandingMotion } from "@/components/landing/landing-motion";
import { StatTile } from "@/components/landing/stat-tile";
import { Tagline } from "@/components/landing/tagline";
import { heroPrimaryCta, heroSecondaryCta, taglineClass } from "@/components/landing/classes";
import { UsdTicker } from "@/components/landing/usd-ticker";
import { PoolSummaryCard } from "@/components/pool/pool-summary-card";
import { formatYield } from "@/lib/format";
import { landingStats } from "@/lib/landing-stats";
import { getReader } from "@/lib/server/context";
import { hiddenPoolIds, listedPools } from "@/lib/listed-pools";

export const dynamic = "force-dynamic";

export default async function Home() {
  const stats = await getReader()
    .listPools()
    .then((pools) => landingStats(listedPools(pools, hiddenPoolIds())))
    .catch(() => null);
  const featured = stats?.featured ?? null;

  return (
    <LandingMotion>
      <div className="-mt-10 flex flex-col">
        {/* Hook: one promise, sample fields drawing on satellite imagery, one live pool card */}
        <section className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_1fr] xl:gap-16">
          <div className="flex flex-col gap-6">
            <h1 className="max-w-[680px] text-[40px] font-semibold text-balance sm:text-[56px]">
              Finance next season&apos;s harvest today.
            </h1>
            <p className="max-w-xl text-base text-pretty text-muted-foreground">
              Farmers raise working capital against 30% of their expected harvest. Fields are verified and attested on Solana.
              Investors earn a fixed yield in USDC, paid at maturity.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/invest/signup" className={heroPrimaryCta}>
                Start investing
              </Link>
              <Link href="/apply" className={heroSecondaryCta}>
                Apply for financing
              </Link>
            </div>
          </div>
          <HeroVisual>
            {featured ? (
              <div className="flex flex-col gap-3">
                <PoolSummaryCard pool={featured} headingLevel="h2" countUp className="shadow-[var(--shadow-pop)]" />
                <p className="flex items-center gap-2 px-1 text-sm text-pretty text-muted-foreground">
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-success" />
                  {`Live on Solana devnet. ${featured.projectCount} ${featured.projectCount === 1 ? "farm project" : "farm projects"}, each field attested on chain.`}
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-border bg-card p-6 text-sm shadow-[var(--shadow-pop)]">
                The first pool opens soon. Every step will be visible on Solana Explorer.
              </p>
            )}
          </HeroVisual>
        </section>

        <section aria-label="Devnet numbers" data-intro className="intro-fade grid gap-8 border-y border-border py-12 sm:grid-cols-3">
          <StatTile label="Open pools" value={stats ? String(stats.openPools) : "Unavailable"} />
          <StatTile label="Raised on devnet" value={stats ? <UsdTicker value={stats.totalRaised} cents={false} /> : "Unavailable"} hint="Test USDC" />
          <StatTile
            label="Featured return"
            value={featured ? `Fixed yield ${formatYield(featured.yieldBps)}` : "Unavailable"}
            hint="Paid at maturity"
          />
        </section>

        {/* Problem, as a large-type tagline */}
        <section className="flex flex-col gap-6 py-24">
          <h2 className="text-sm font-semibold text-muted-foreground">The problem</h2>
          <Tagline
            className={taglineClass}
            text="Seed, fertilizer and fuel are paid in spring. The grain arrives in autumn. Banks want collateral the farmer does not have yet."
          />
          <p data-reveal className="max-w-2xl text-base text-pretty text-muted-foreground">
            Field-to-Finance turns verified fields into an instrument investors can buy today, so the money arrives when the
            season starts and not after it ends.
          </p>
        </section>

        {/* How it works */}
        <section data-rail-section className="band-surface flex flex-col gap-10 py-24">
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-balance sm:text-[40px]">How a deal moves</h2>
            <p className="max-w-2xl text-base text-pretty text-muted-foreground">
              Seven steps from a field boundary to a paid investor. The program enforces the order.
            </p>
          </div>
          <DealPath />
        </section>

        {/* Proof */}
        <section className="flex flex-col gap-10 py-24 sm:py-32">
          <h2 className="max-w-[680px] text-2xl font-semibold text-balance sm:text-[40px]">Investors are protected by rules, not promises</h2>
          <ul data-reveal data-reveal-group className="grid gap-8 sm:grid-cols-3">
            <li className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-base font-semibold">70% buffer</h3>
              <p className="text-sm text-pretty text-muted-foreground">Only 30% of each farm&apos;s expected harvest backs the Instrument.</p>
            </li>
            <li className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-base font-semibold">Shortfall rules</h3>
              <p className="text-sm text-pretty text-muted-foreground">
                Missing volume comes from other fields, missing quality is bought on the market, otherwise the farmer repays in USD
                with a fixed premium.
              </p>
            </li>
            <li className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-base font-semibold">Compliance in the token</h3>
              <p className="text-sm text-pretty text-muted-foreground">
                Instrument accounts are frozen until KYC passes, so an unapproved wallet cannot hold it.
              </p>
            </li>
          </ul>
          {featured ? (
            <div data-reveal className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
              <p className="text-sm font-semibold">Check it yourself on Solana Explorer</p>
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-muted-foreground">Pool account</dt>
                <dd>
                  <ExplorerLink kind="address" value={featured.address} />
                </dd>
                <dt className="text-muted-foreground">Instrument mint</dt>
                <dd>
                  <ExplorerLink kind="address" value={featured.mint} />
                </dd>
                <dt className="text-muted-foreground">USDC vault</dt>
                <dd>
                  <ExplorerLink kind="address" value={featured.vault} />
                </dd>
              </dl>
              <p className="text-sm text-muted-foreground">Pilot farms in northern Kazakhstan. The demo pool uses sample fields near Kostanay.</p>
            </div>
          ) : null}
        </section>

        {/* Close */}
        <section className="flex flex-col items-start gap-6 border-t border-border pt-24">
          <h2 className="max-w-[680px] text-2xl font-semibold text-balance sm:text-[40px]">Open a pool and read every attestation</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/pools" className={heroPrimaryCta}>
              View open pools
            </Link>
            <Link href="/apply" className={heroSecondaryCta}>
              Raise financing for your farm
            </Link>
          </div>
        </section>
      </div>
    </LandingMotion>
  );
}

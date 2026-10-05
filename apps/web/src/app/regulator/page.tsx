import type { Metadata } from "next";
import Link from "next/link";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardServiceCabinet } from "@/components/cabinet/guard";
import { primaryLink, Section, textLink } from "@/components/cabinet/section";
import { RegistryTable } from "@/components/regulator/tables";
import { REGULATOR_TABS } from "@/components/regulator/tabs";
import { ErrorState } from "@/components/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDb } from "@/lib/server/db";
import { regulatorData } from "@/lib/server/regulator-data";

export const metadata: Metadata = { title: "Regulator registry", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUSES = ["Open", "Funded", "Refunding", "Redeeming"];
const select = "h-10 rounded-md border border-input bg-card px-2.5 text-base md:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default async function RegulatorHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const g = await guardServiceCabinet(["regulator"], "/regulator");
  if ("element" in g) return g.element;
  const sp = await searchParams;
  const f = { status: sp.status?.trim() || undefined, poolId: sp.pool?.trim() || undefined, bin: sp.bin?.trim() || undefined, iin: sp.iin?.trim() || undefined };
  let data;
  try {
    data = await regulatorData(await getDb(), Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)));
  } catch {
    return <ErrorState level={1} title="The registry is unavailable" body="Pools or accounts did not answer. Try again in a minute." retryHref="/regulator" />;
  }
  const query = new URLSearchParams(Object.entries(f).filter((e): e is [string, string] => e[1] !== undefined).map(([k, v]) => [k === "poolId" ? "pool" : k, v])).toString();
  const exportHref = (kind: string) => `/api/regulator/export?kind=${kind}${query ? `&${query}` : ""}`;
  return (
    <CabinetShell role="Regulator" title="Registry of issues" email={g.user.email} tabs={REGULATOR_TABS}>
      <p className="max-w-prose text-sm text-muted-foreground">Read-only. Every published pool with its issuer, terms, status, money raised and holders. BIN and IIN come from the platform&apos;s private records; nothing personal is on-chain.</p>
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter the registry">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Status
          <select name="status" defaultValue={f.status ?? ""} className={select}>
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Pool
          <Input name="pool" defaultValue={f.poolId ?? ""} inputMode="numeric" className="tabular h-10 w-24" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Issuer BIN
          <Input name="bin" defaultValue={f.bin ?? ""} inputMode="numeric" maxLength={12} className="tabular h-10 w-40" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Investor IIN
          <Input name="iin" defaultValue={f.iin ?? ""} inputMode="numeric" maxLength={12} className="tabular h-10 w-40" />
        </label>
        <Button type="submit" variant="outline" className="h-10">
          Filter
        </Button>
        {query ? (
          <Link href="/regulator" className={`${textLink} self-center text-sm`}>
            Clear
          </Link>
        ) : null}
      </form>
      <Section
        title={`Pools (${data.registry.length})`}
        action={
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <a href={exportHref("registry")} className={primaryLink}>
              Export registry (CSV)
            </a>
            <a href={exportHref("holders")} className={textLink}>
              Holders CSV
            </a>
            <a href={exportHref("events")} className={textLink}>
              Events CSV
            </a>
          </div>
        }
      >
        {data.registry.some((r) => r.holders === null || !r.holdersComplete) ? (
          <p className="max-w-prose text-sm text-muted-foreground">Some holder lists are partial: this RPC endpoint does not index token accounts, so counts marked &ldquo;at least&rdquo; or &ldquo;–&rdquo; and the IIN filter cover the platform&apos;s linked wallets only.</p>
        ) : null}
        <RegistryTable rows={data.registry} />
      </Section>
    </CabinetShell>
  );
}

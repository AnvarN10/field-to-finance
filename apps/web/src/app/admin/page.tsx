import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/admin/action-button";
import { ExplorerLink } from "@/components/explorer-link";
import { CreatePoolForm } from "@/components/admin/create-pool-form";
import { PoolConsole } from "@/components/admin/pool-console";
import { ScasStubBadge } from "@/components/scas-stub-badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/state";
import { ADMIN_COOKIE, isAdminToken } from "@/lib/admin-auth";
import { nextPoolId, roleMismatches } from "@/lib/chain/admin-ops";
import { formatHa } from "@/lib/format";
import { getReader, roleKeypair } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";
import { logoutAction, verifyAllFieldsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo console", robots: { index: false } };

function safeKey(role: "issuer" | "compliance" | "scas"): string | undefined {
  try {
    return roleKeypair(role).publicKey.toBase58();
  } catch {
    return undefined;
  }
}

export default async function AdminPage() {
  if (!serverEnv().ADMIN_PASSWORD) return <ErrorState level={1} title="Demo console is disabled" body="Set ADMIN_PASSWORD on the server to enable it." />;
  if (!isAdminToken(serverEnv().ADMIN_PASSWORD, (await cookies()).get(ADMIN_COOKIE)?.value)) redirect("/admin/login");

  const reader = getReader();
  let data;
  try {
    const [config, pools, unpooled] = await Promise.all([reader.config(), reader.listPools(), reader.unpooledProjects()]);
    const details = (await Promise.all(pools.map((p) => reader.getPool(p.poolId)))).filter((d) => d !== null);
    data = { config, pools, unpooled, details };
  } catch {
    return <ErrorState level={1} title="Could not load devnet state" body="Solana devnet did not answer." retryHref="/admin" />;
  }
  const keys = { issuer: safeKey("issuer"), compliance: safeKey("compliance"), scas: safeKey("scas") };
  const mismatches = roleMismatches(data.config, keys);
  const missing = Object.entries(keys).filter(([, v]) => !v).map(([k]) => k);
  const unverified = data.unpooled.flatMap((p) => p.fields.filter((f) => !f.verified));
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Demo console</h1>
        <form action={logoutAction}>
          <Button type="submit" variant="link" className="h-auto px-0 text-foreground">
            Sign out
          </Button>
        </form>
      </header>

      {mismatches.length || missing.length ? (
        <div role="alert" className="rounded-lg border border-destructive bg-card p-4 text-sm">
          {missing.length ? <p>{`Missing keys on the server: ${missing.join(", ")}. Add them to Infisical (field-to-finance, dev) and restart the server.`}</p> : null}
          {mismatches.map((m) => <p key={m}>{m}</p>)}
        </div>
      ) : null}

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Field verification</h2>
          <ScasStubBadge />
        </div>
        {unverified.length ? (
          <ul className="tabular text-sm text-muted-foreground">
            {unverified.map((f) => (
              <li key={f.address} className="flex flex-wrap items-center gap-2">
                {`Field ${f.index + 1}, ${formatHa(f.areaHaX100)}, project`} <ExplorerLink kind="address" value={f.project} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Every field of every project waiting for a pool is verified.</p>
        )}
        <ActionButton label="Verify all fields" role="SCAS stub" action={verifyAllFieldsAction} disabled={unverified.length === 0} disabledReason={unverified.length === 0 ? "Nothing to verify" : undefined} />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl font-semibold">Create a pool</h2>
        <CreatePoolForm defaultPoolId={nextPoolId(data.pools.map((p) => p.poolId))} />
      </section>

      {data.details.length === 0 ? (
        <EmptyState title="No pools yet" body="Create one above, add a verified project, then open it." />
      ) : (
        data.details.map((d) => <PoolConsole key={d.pool.address} detail={d} unpooled={data.unpooled} now={now} />)
      )}
    </div>
  );
}

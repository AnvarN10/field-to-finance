import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-button";
import { RoleForm } from "@/components/arranger/role-form";
import { ARRANGER_TABS } from "@/components/arranger/tabs";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { guardCabinet } from "@/components/cabinet/guard";
import { Panel, Section } from "@/components/cabinet/section";
import { ErrorState } from "@/components/state";
import { getDb } from "@/lib/server/db";
import { listUsersWithRoles } from "@/lib/workflow/users";
import { revokeRoleAction } from "../workflow-actions";

export const metadata: Metadata = { title: "Roles", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const g = await guardCabinet("arranger", "/arranger/roles");
  if ("element" in g) return g.element;
  let people;
  try {
    people = await listUsersWithRoles(await getDb());
  } catch {
    return <ErrorState level={1} title="Your cabinet is unavailable" body="Accounts could not be loaded. Try again in a minute." retryHref="/arranger/roles" />;
  }
  return (
    <CabinetShell role="Arranger" title="Roles" email={g.user.email} tabs={ARRANGER_TABS}>
      <Section title="Grant a role" description="Arrangers also act as compliance and SCAS-stub operators in this pilot. Grant the role only to the F2F team.">
        <Panel className="max-w-3xl">
          <RoleForm />
        </Panel>
      </Section>
      <Section title={`Accounts (${people.length})`}>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {people.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium break-all">{p.email}</span>
                <span className="text-xs text-muted-foreground">{p.signedIn ? "Signed in at least once" : "Has not signed in yet"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {p.roles.length === 0 ? <span className="text-sm text-muted-foreground">No role</span> : null}
                {p.roles.map((r) => (
                  <ActionButton
                    key={r}
                    label={`Remove ${r}`}
                    role="Arranger"
                    action={revokeRoleAction.bind(null, p.id, r)}
                    confirmText={`Remove the ${r} role from ${p.email}?`}
                    disabled={r === "arranger" && p.id === g.user.id}
                    disabledReason={r === "arranger" && p.id === g.user.id ? "You cannot remove your own arranger role" : undefined}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </CabinetShell>
  );
}

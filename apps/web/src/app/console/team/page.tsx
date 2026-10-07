import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-button";
import { Section } from "@/components/cabinet/section";
import { ConsolePage } from "@/components/console/console-page";
import { guardConsole } from "@/components/console/guard";
import { InviteForm } from "@/components/console/invite-form";
import { MemberRoles } from "@/components/console/member-roles";
import { PermissionMatrix } from "@/components/console/permission-matrix";
import { ErrorState } from "@/components/state";
import { formatDateUtc } from "@/lib/format";
import { CONSOLE_ROLE_LABELS } from "@/lib/permissions";
import { getDb } from "@/lib/server/db";
import { listInvitations, listMembers } from "@/lib/workflow/team";
import { revokeInvitationAction } from "@/app/console/_actions/team";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

const secs = (d: Date) => Math.floor(d.getTime() / 1000);

export default async function TeamPage() {
  const g = await guardConsole("team.manage", "/console/team");
  if ("element" in g) return g.element;
  let members, invitations;
  try {
    const db = await getDb();
    [members, invitations] = await Promise.all([listMembers(db), listInvitations(db)]);
  } catch {
    return <ErrorState level={1} title="This section is unavailable" body="The team could not be loaded. Try again in a minute." retryHref="/console/team" />;
  }
  return (
    <ConsolePage title="Team" description="Console members join by invitation and see only what their roles allow. Investors and farmers open their own accounts through the sign-up doors.">
      <Section title="Invite a member" description="The link works once, for the invited email only, for 7 days.">
        <div className="rounded-lg border border-border bg-card p-6">
          <InviteForm />
        </div>
      </Section>

      <Section title={`Open invitations (${invitations.length})`}>
        {invitations.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="break-all font-medium">{i.email}</span>
                  <span className="tabular text-muted-foreground">
                    {`${i.roles.map((r) => CONSOLE_ROLE_LABELS[r].name).join(", ")} · ${i.expired ? "expired" : `expires ${formatDateUtc(secs(i.expiresAt))}`}`}
                  </span>
                </div>
                <ActionButton label="Withdraw" role="Platform" hideRole variant="outline" action={revokeInvitationAction.bind(null, i.id)} confirmText={`Withdraw the invitation for ${i.email}? The link stops working.`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No open invitations.</p>
        )}
      </Section>

      <Section title={`Members (${members.length})`}>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {members.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="break-all font-medium">{m.email}</span>
                <span className="tabular text-xs text-muted-foreground">{`${m.signedIn ? "Signed in" : "Not signed in yet"} · member since ${formatDateUtc(secs(m.since))}`}</span>
              </div>
              <MemberRoles userId={m.id} email={m.email} roles={m.roles} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What each role can do" description="Roles are bundles of permissions defined by the platform. Every page and action checks the permission, not the role name.">
        <PermissionMatrix />
      </Section>
    </ConsolePage>
  );
}

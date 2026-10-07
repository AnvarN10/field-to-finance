"use server";

import * as Sentry from "@sentry/nextjs";
import type { ActionResult } from "@/lib/action-result";
import { parseArrangerEmails } from "@/lib/auth/session";
import { RequestError } from "@/lib/errors";
import { requirePermission } from "@/lib/server/auth";
import { consoleAction } from "@/lib/server/console-action";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { createInvitation, revokeInvitation, setMemberRoles } from "@/lib/workflow/team";

export type InviteResult = { ok: true; link: string; expiresAt: string; roles: string[] } | { ok: false; error: string };

/** Creates an invitation and returns its link once (only the token's hash is stored). */
export async function inviteAction(email: string, roles: string[]): Promise<InviteResult> {
  try {
    const actor = await requirePermission("team.manage");
    const r = await createInvitation(await getDb(), actor.user, { email: String(email), roles: Array.isArray(roles) ? roles.map(String) : [] });
    return { ok: true, link: `${serverEnv().PUBLIC_BASE_URL}/invite/${r.token}`, expiresAt: r.expiresAt.toISOString(), roles };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: e.message };
    Sentry.captureException(e);
    return { ok: false, error: "The invitation could not be created. Try again in a minute." };
  }
}

export const revokeInvitationAction = async (id: string): Promise<ActionResult> =>
  consoleAction("team.manage", "Invitation withdrawn", (u, db) => revokeInvitation(db, u, id));

export const setMemberRolesAction = async (userId: string, roles: string[]): Promise<ActionResult> =>
  consoleAction("team.manage", "Roles saved", (u, db) => setMemberRoles(db, u, userId, Array.isArray(roles) ? roles.map(String) : [], parseArrangerEmails(serverEnv().ARRANGER_EMAILS)));

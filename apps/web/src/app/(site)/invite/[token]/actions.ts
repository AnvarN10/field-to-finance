"use server";

import * as Sentry from "@sentry/nextjs";
import { RequestError } from "@/lib/errors";
import { currentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { acceptInvitation } from "@/lib/workflow/team";

export type AcceptResult = { ok: true } | { ok: false; error: string };

/** Accepts the invitation for the signed-in user (email must match; single use; see team.ts). */
export async function acceptInvitationAction(token: string): Promise<AcceptResult> {
  try {
    const user = await currentUser();
    if (!user) return { ok: false, error: "Your session expired. Sign in again." };
    await acceptInvitation(await getDb(), user, String(token));
    return { ok: true };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: e.message };
    Sentry.captureException(e);
    return { ok: false, error: "The invitation could not be accepted. Try again in a minute." };
  }
}

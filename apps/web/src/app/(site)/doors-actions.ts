"use server";

import * as Sentry from "@sentry/nextjs";
import { homeFor } from "@/lib/auth/home";
import { RequestError } from "@/lib/errors";
import { currentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { openAccount, type Door } from "@/lib/workflow/accounts";

export type OpenAccountResult = { ok: true; home: string } | { ok: false; error: string; home: string | null };

/** Where each door's new account starts: verification for investors, the company file for issuers. */
const START: Record<Door, string> = { investor: "/invest/account", issuer: "/issuer/company" };

/** Called by a sign-up door right after Privy sign-in: opens that door's account kind (never a choice). */
export async function openAccountAction(door: Door): Promise<OpenAccountResult> {
  let home: string | null = null;
  try {
    const user = await currentUser();
    if (!user) return { ok: false, error: "Your session expired. Sign in again.", home: null };
    home = homeFor(user.roles);
    if (door !== "investor" && door !== "issuer") throw new RequestError("Unknown sign-up door.", 400);
    await openAccount(await getDb(), user, door);
    return { ok: true, home: START[door] };
  } catch (e) {
    if (e instanceof RequestError) return { ok: false, error: e.message, home };
    Sentry.captureException(e);
    return { ok: false, error: "Your account could not be opened. Try again in a minute.", home };
  }
}

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseArrangerEmails, SESSION_COOKIE, signInWithToken } from "@/lib/auth/session";
import { RequestError } from "@/lib/errors";
import { isCrossSite } from "@/lib/same-origin";
import { getDb } from "@/lib/server/db";
import { serverEnv } from "@/lib/server/env";
import { getPrivy } from "@/lib/server/privy";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(1).max(4_096) });
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } });

/** Exchanges a Privy access token for the session cookie (the token itself, re-verified on every request). */
export async function POST(req: Request) {
  if (isCrossSite(req)) return fail(403, "Sign in from the Field-to-Finance site.");
  // A JSON content type forces a CORS preflight, so a cross-site form or no-cors fetch cannot reach here.
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return fail(415, "Send the token as JSON.");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return fail(400, "A Privy access token is required.");
  let db;
  try {
    db = await getDb();
  } catch {
    return fail(503, "Accounts are unavailable right now. Try again in a minute.");
  }
  try {
    const { user, expiresAt } = await signInWithToken(db, getPrivy(), b.data.token, parseArrangerEmails(serverEnv().ARRANGER_EMAILS));
    const res = NextResponse.json({ ok: true, roles: user.roles }, { headers: { "cache-control": "no-store" } });
    res.cookies.set(SESSION_COOKIE, b.data.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(expiresAt * 1000),
    });
    return res;
  } catch (e) {
    if (e instanceof RequestError) return fail(e.status, e.message);
    Sentry.captureException(e);
    return fail(503, "Accounts are unavailable right now. Try again in a minute.");
  }
}

export async function DELETE(req: Request) {
  if (isCrossSite(req)) return fail(403, "Sign out from the Field-to-Finance site.");
  const res = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return res;
}

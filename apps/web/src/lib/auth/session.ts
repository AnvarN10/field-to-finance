import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { platformSettings, userRoles, users, wallets, type Role } from "../db/schema";
import { RequestError } from "../errors";

/** httpOnly cookie holding the Privy access token; re-verified on every protected request. */
export const SESSION_COOKIE = "f2f_session";

/** The two Privy calls the platform needs; the server adapter wraps @privy-io/server-auth, tests use a fake. */
export interface PrivyPort {
  verify(token: string): Promise<{ did: string; expiresAt: number }>;
  profile(did: string): Promise<{ email: string | null; solanaWallets: string[] }>;
}

export interface SessionUser {
  id: string;
  email: string;
  roles: Role[];
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export const parseArrangerEmails = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter((e) => e.includes("@"));

export async function rolesOf(db: Db, userId: string): Promise<Role[]> {
  const rows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role).sort();
}

/**
 * Verifies a Privy access token and returns the platform user, creating it on first sign-in.
 * ARRANGER_EMAILS grants the arranger role at every sign-in that lacks it, so a listed address that signed in before the
 * variable was set recovers on its next sign-in.
 */
export async function signInWithToken(db: Db, privy: PrivyPort, token: string, arrangerEmails: string[]) {
  let claims: { did: string; expiresAt: number };
  try {
    claims = await privy.verify(token);
  } catch {
    throw new RequestError("Sign-in could not be verified. Sign in again.", 401);
  }
  if (claims.did.startsWith("did:dev:") && (await isProductionDb(db))) {
    throw new RequestError("Dev sign-in is not allowed against the production database.", 403);
  }
  let user = await db.query.users.findFirst({ where: eq(users.privyDid, claims.did) });
  let profile: { email: string | null; solanaWallets: string[] } | null = null;
  if (!user) {
    profile = await privy.profile(claims.did);
    if (!profile.email) throw new RequestError("Sign in with an email address.", 403);
    const email = normalizeEmail(profile.email);
    const byEmail = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (byEmail && byEmail.privyDid && byEmail.privyDid !== claims.did) {
      throw new RequestError("This email belongs to another sign-in. Contact an arranger.", 409);
    }
    [user] = byEmail
      ? await db.update(users).set({ privyDid: claims.did }).where(eq(users.id, byEmail.id)).returning()
      : await db.insert(users).values({ email, privyDid: claims.did }).returning();
    if (!user) throw new Error("user upsert returned no row");
  }
  if (arrangerEmails.includes(user.email)) await db.insert(userRoles).values({ userId: user.id, role: "arranger" }).onConflictDoNothing();
  // Privy creates the embedded wallet right after the first login, so keep asking until it is recorded.
  const embedded = await db.query.wallets.findFirst({ where: and(eq(wallets.userId, user.id), eq(wallets.kind, "privy-embedded")) });
  if (!embedded) {
    profile ??= await privy.profile(claims.did);
    for (const address of profile.solanaWallets) {
      await db.insert(wallets).values({ address, userId: user.id, kind: "privy-embedded" }).onConflictDoNothing();
    }
  }
  return { user: { id: user.id, email: user.email, roles: await rolesOf(db, user.id) }, expiresAt: claims.expiresAt };
}

/** Whether this database is marked as production (`platform_settings.environment`); a trigger also enforces it. */
export async function isProductionDb(db: Db): Promise<boolean> {
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, "environment") });
  return row?.value === "production";
}

/** The signed-in user for a session cookie value, or null when the token is missing, invalid, expired or unknown. */
export async function resolveSession(db: Db, privy: PrivyPort, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  let did: string;
  try {
    did = (await privy.verify(token)).did;
  } catch {
    return null;
  }
  const user = await db.query.users.findFirst({ where: eq(users.privyDid, did) });
  return user ? { id: user.id, email: user.email, roles: await rolesOf(db, user.id) } : null;
}

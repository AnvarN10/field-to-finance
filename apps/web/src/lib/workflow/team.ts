import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { normalizeEmail, type SessionUser } from "../auth/session";
import type { Db } from "../db/client";
import { consoleInvitations, userRoles, users } from "../db/schema";
import { isUniqueViolation } from "../db/errors";
import { RequestError } from "../errors";
import { CONSOLE_ROLE_LABELS, CONSOLE_ROLES, isConsoleRole, type ConsoleRole } from "../permissions";
import { audit } from "./audit";
import { assertPermission, assertUuid } from "./guards";
import { notify } from "./notifications";

/** Invitation links live this long (ADR 0018). */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** `alice@example.com` → `a***@example.com`: enough for the invitee to recognise, nothing for a bystander. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.length > 1 ? local.slice(0, 1) : ""}***@${domain}`;
}

const rolesInput = z
  .array(z.string())
  .min(1, { error: "choose at least one role" })
  .refine((rs) => rs.every(isConsoleRole), { error: "choose console roles only" });

function parseRoles(roles: readonly string[], allowEmpty: boolean): ConsoleRole[] {
  const r = (allowEmpty ? rolesInput.or(z.array(z.never()).length(0)) : rolesInput).safeParse(roles);
  if (!r.success) throw new RequestError(r.error.issues[0]?.message ?? "Check the roles", 400);
  // Stable order, no duplicates.
  return CONSOLE_ROLES.filter((c) => (r.data as string[]).includes(c));
}

const emailInput = z.email({ error: "enter a valid email" });

/**
 * Invites an email into the console with one or more roles. Any open invitation for that email is revoked in the same
 * transaction. Returns the token once; only its SHA-256 is stored.
 */
export async function createInvitation(db: Db, actor: SessionUser, input: { email: string; roles: readonly string[] }, now = new Date()): Promise<{ id: string; token: string; expiresAt: Date }> {
  assertPermission(actor, "team.manage");
  const email = emailInput.safeParse(normalizeEmail(input.email));
  if (!email.success) throw new RequestError("Enter a valid email", 400);
  const roles = parseRoles(input.roles, false);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
  const insert = () =>
    db.transaction(async (tx) => {
      await tx
        .update(consoleInvitations)
        .set({ revokedAt: now, revokedBy: actor.id })
        .where(and(eq(consoleInvitations.email, email.data), isNull(consoleInvitations.acceptedAt), isNull(consoleInvitations.revokedAt)));
      const [row] = await tx.insert(consoleInvitations).values({ email: email.data, roles, tokenHash: hashToken(token), invitedBy: actor.id, createdAt: now, expiresAt }).returning({ id: consoleInvitations.id });
      if (!row) throw new Error("invitation insert returned no row");
      await audit(tx as unknown as Db, { actorUserId: actor.id, action: "team.invite", targetType: "invitation", targetId: row.id, payload: { roles } });
      return row.id;
    });
  let id: string;
  try {
    id = await insert();
  } catch (e) {
    // Someone else invited this email at the same moment (one open invitation per email).
    if (isUniqueViolation(e)) throw new RequestError("An invitation for this email was just created. Refresh the page.", 409);
    throw e;
  }
  return { id, token, expiresAt };
}

export type InvitationState = "valid" | "expired" | "revoked" | "used" | "invalid";
export type InvitationView = { state: InvitationState; roles?: ConsoleRole[]; maskedEmail?: string; expiresAt?: Date };

function stateOf(row: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): InvitationState {
  if (row.acceptedAt) return "used";
  if (row.revokedAt) return "revoked";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/** What the invitation page may show for a token. Roles and the masked email only while the invitation is valid. */
export async function inspectInvitation(db: Db, token: string, now = new Date()): Promise<InvitationView> {
  if (!TOKEN.test(token)) return { state: "invalid" };
  const row = await db.query.consoleInvitations.findFirst({ where: eq(consoleInvitations.tokenHash, hashToken(token)) });
  if (!row) return { state: "invalid" };
  const state = stateOf(row, now);
  return state === "valid" ? { state, roles: row.roles, maskedEmail: maskEmail(row.email), expiresAt: row.expiresAt } : { state };
}

const GONE: Record<Exclude<InvitationState, "valid" | "invalid">, string> = {
  used: "This invitation was already used.",
  revoked: "This invitation was withdrawn. Ask the F2F team for a new one.",
  expired: "This invitation has expired. Ask the F2F team for a new one.",
};

/**
 * Accepts an invitation for the signed-in user: the row is locked, must be open and unexpired, and the user's email must
 * be the invited one. Grants every role (granted by the inviter), marks the invitation used, audits, notifies the inviter.
 */
export async function acceptInvitation(db: Db, user: SessionUser, token: string, now = new Date()): Promise<ConsoleRole[]> {
  if (!TOKEN.test(token)) throw new RequestError("This invitation link is not valid.", 404);
  const accepted = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(consoleInvitations).where(eq(consoleInvitations.tokenHash, hashToken(token))).for("update");
    if (!row) throw new RequestError("This invitation link is not valid.", 404);
    const state = stateOf(row, now);
    if (state !== "valid") throw new RequestError(GONE[state as keyof typeof GONE], 410);
    if (normalizeEmail(user.email) !== row.email) throw new RequestError("This invitation is for another email.", 403);
    // Conditional update: a concurrent accept that slipped past the lock still cannot use the invitation twice.
    const used = await tx
      .update(consoleInvitations)
      .set({ acceptedAt: now, acceptedBy: user.id })
      .where(and(eq(consoleInvitations.id, row.id), isNull(consoleInvitations.acceptedAt), isNull(consoleInvitations.revokedAt)))
      .returning({ id: consoleInvitations.id });
    if (!used.length) throw new RequestError(GONE.used, 410);
    for (const role of row.roles) await tx.insert(userRoles).values({ userId: user.id, role, grantedBy: row.invitedBy }).onConflictDoNothing();
    await audit(tx as unknown as Db, { actorUserId: user.id, action: "team.invitation.accept", targetType: "invitation", targetId: row.id, payload: { roles: row.roles } });
    return row;
  });
  if (accepted.invitedBy) {
    const names = accepted.roles.map((r) => CONSOLE_ROLE_LABELS[r].name).join(", ");
    await notify(db, accepted.invitedBy, "team", `${user.email} joined the console`, `Invitation accepted with: ${names}.`, "/console/team");
  }
  return accepted.roles;
}

export async function revokeInvitation(db: Db, actor: SessionUser, id: string, now = new Date()): Promise<void> {
  assertPermission(actor, "team.manage");
  assertUuid(id, "Invitation");
  const rows = await db
    .update(consoleInvitations)
    .set({ revokedAt: now, revokedBy: actor.id })
    .where(and(eq(consoleInvitations.id, id), isNull(consoleInvitations.acceptedAt), isNull(consoleInvitations.revokedAt)))
    .returning({ id: consoleInvitations.id });
  if (!rows.length) throw new RequestError("The invitation is not open.", 404);
  await audit(db, { actorUserId: actor.id, action: "team.invitation.revoke", targetType: "invitation", targetId: id });
}

export type OpenInvitation = { id: string; email: string; roles: ConsoleRole[]; createdAt: Date; expiresAt: Date; expired: boolean };

/** Invitations neither accepted nor revoked, newest first; expired ones are flagged. */
export async function listInvitations(db: Db, now = new Date()): Promise<OpenInvitation[]> {
  const rows = await db
    .select()
    .from(consoleInvitations)
    .where(and(isNull(consoleInvitations.acceptedAt), isNull(consoleInvitations.revokedAt)))
    .orderBy(asc(consoleInvitations.createdAt));
  return rows.reverse().map((r) => ({ id: r.id, email: r.email, roles: r.roles, createdAt: r.createdAt, expiresAt: r.expiresAt, expired: r.expiresAt.getTime() <= now.getTime() }));
}

export type ConsoleMember = { id: string; email: string; roles: ConsoleRole[]; signedIn: boolean; since: Date };

/** Users holding at least one console role, with those roles only (account kinds are not shown). */
export async function listMembers(db: Db): Promise<ConsoleMember[]> {
  const grants = await db.select().from(userRoles).where(inArray(userRoles.role, [...CONSOLE_ROLES]));
  if (!grants.length) return [];
  const ids = [...new Set(grants.map((g) => g.userId))];
  const people = await db.select().from(users).where(inArray(users.id, ids)).orderBy(asc(users.email));
  return people.map((u) => {
    const mine = grants.filter((g) => g.userId === u.id);
    return {
      id: u.id,
      email: u.email,
      roles: CONSOLE_ROLES.filter((r) => mine.some((g) => g.role === r)),
      signedIn: u.privyDid !== null,
      since: new Date(Math.min(...mine.map((g) => g.grantedAt.getTime()))),
    };
  });
}

/**
 * Replaces a member's console roles (account kinds stay). Removing the arranger role keeps the ADR 0016 rules: not your
 * own, not an `ARRANGER_EMAILS` address, and never the last arranger (every arranger row is locked first).
 */
export async function setMemberRoles(db: Db, actor: SessionUser, userId: string, roles: readonly string[], arrangerEmails: string[] = []): Promise<void> {
  assertPermission(actor, "team.manage");
  assertUuid(userId, "User");
  const wanted = parseRoles(roles, true);
  const change = await db.transaction(async (tx) => {
    const target = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (!target) throw new RequestError("User not found", 404);
    const current = (await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId))).map((r) => r.role).filter(isConsoleRole);
    // Console roles are granted by invitation only (ADR 0018); this edits existing members, it never makes new ones.
    if (!current.length) throw new RequestError("Not a console member. Invite them instead.", 409);
    const added = wanted.filter((r) => !current.includes(r));
    const removed = current.filter((r) => !wanted.includes(r));
    if (removed.includes("arranger")) {
      if (userId === actor.id) throw new RequestError("You cannot remove your own arranger role.", 409);
      if (arrangerEmails.includes(target.email)) throw new RequestError("This address is in ARRANGER_EMAILS and gets the role back at sign-in. Remove it there first.", 409);
      const arrangers = await tx.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "arranger")).for("update");
      if (arrangers.length <= 1) throw new RequestError("Keep at least one arranger.", 409);
    }
    if (removed.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.role, removed)));
    for (const role of added) await tx.insert(userRoles).values({ userId, role, grantedBy: actor.id }).onConflictDoNothing();
    if (added.length || removed.length) await audit(tx as unknown as Db, { actorUserId: actor.id, action: "team.member.roles", targetType: "user", targetId: userId, payload: { added, removed } });
    return { added };
  });
  if (change.added.length) {
    const names = change.added.map((r) => CONSOLE_ROLE_LABELS[r].name).join(", ");
    await notify(db, userId, "role", "Your console access changed", `You now also have: ${names}.`, "/console");
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "f2f_admin";

/** Session cookie value: an HMAC of a fixed label keyed by the password; rotating the password logs everyone out. */
export const adminToken = (password: string) => createHmac("sha256", password).update("f2f-admin-session-v1").digest("hex");

const digest = (s: string) => createHmac("sha256", "f2f-admin-compare").update(s).digest();

export const passwordMatches = (expected: string, given: string) => timingSafeEqual(digest(expected), digest(given));

export function isAdminToken(password: string | undefined, token: string | undefined): boolean {
  if (!password || !token) return false;
  return timingSafeEqual(digest(adminToken(password)), digest(token));
}

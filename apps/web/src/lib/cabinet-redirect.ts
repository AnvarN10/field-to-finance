import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./auth/session";

const CABINET = /^\/(farmer|investor|arranger|compliance|scas|elevator|regulator)(\/|$)/;

/**
 * Cheap first gate for the cabinets: no session cookie, straight to sign-in with a real 307. A present cookie is only a
 * hint; every page, action and route still verifies the token with Privy and loads roles from Postgres.
 * Only page loads (GET/HEAD) are redirected: a server action POST from an open page must reach the action, which
 * answers "Your session expired. Sign in again." instead of a silent redirect the form cannot show.
 */
export function cabinetRedirect(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (!CABINET.test(pathname) || request.cookies.get(SESSION_COOKIE)?.value) return null;
  if ((request.method !== "GET" && request.method !== "HEAD") || request.headers.has("next-action")) return null;
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url, 307);
}

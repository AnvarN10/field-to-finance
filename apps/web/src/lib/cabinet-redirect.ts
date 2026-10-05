import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./auth/session";

const CABINET = /^\/(farmer|investor|arranger)(\/|$)/;

/**
 * Cheap first gate for the cabinets: no session cookie, straight to sign-in with a real 307. A present cookie is only a
 * hint; every page, action and route still verifies the token with Privy and loads roles from Postgres.
 */
export function cabinetRedirect(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (!CABINET.test(pathname) || request.cookies.get(SESSION_COOKIE)?.value) return null;
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url, 307);
}

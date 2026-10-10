import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/** HTTP Basic Auth in front of the whole platform (ADR 0015). Railway has no Caddy, so the Next.js proxy does it. */
export const BASIC_AUTH_REALM = 'Basic realm="Field-to-Finance", charset="UTF-8"';

/** Paths reachable without credentials. Only the Railway healthcheck; matched exactly, so encodings and suffixes stay protected. */
const PUBLIC_PATHS = new Set(["/api/health"]);

export const isPublicPath = (pathname: string) => PUBLIC_PATHS.has(pathname);

export type BasicAuthMode = { kind: "on"; user: string; password: string } | { kind: "off" } | { kind: "locked" };

/** BASIC_AUTH=off: off (public launch). Both variables set: on. Unset outside production: off (local dev, tests). Unset in production: locked, fail closed. */
export function basicAuthMode(env: NodeJS.ProcessEnv): BasicAuthMode {
  if (env.BASIC_AUTH === "off") return { kind: "off" };
  const user = env.BASIC_AUTH_USER;
  const password = env.BASIC_AUTH_PASSWORD;
  if (user && password) return { kind: "on", user, password };
  return env.NODE_ENV === "production" ? { kind: "locked" } : { kind: "off" };
}

// Comparing fixed-length HMACs keeps the comparison constant-time regardless of input length.
const digest = (s: string) => createHmac("sha256", "f2f-basic-auth-compare").update(s, "utf8").digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export function credentialsMatch(authorization: string | null | undefined, user: string, password: string): boolean {
  if (!authorization) return false;
  const match = /^basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(authorization);
  if (!match) return false;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon < 0) return false;
  // Evaluate both comparisons, so a wrong user and a wrong password take the same time.
  const userOk = same(decoded.slice(0, colon), user);
  const passwordOk = same(decoded.slice(colon + 1), password);
  return userOk && passwordOk;
}

export function basicAuthResponse(request: NextRequest, env: NodeJS.ProcessEnv): NextResponse {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  const mode = basicAuthMode(env);
  if (mode.kind === "off") return NextResponse.next();
  if (mode.kind === "locked") {
    return new NextResponse("Access is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  if (credentialsMatch(request.headers.get("authorization"), mode.user, mode.password)) return NextResponse.next();
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "www-authenticate": BASIC_AUTH_REALM, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

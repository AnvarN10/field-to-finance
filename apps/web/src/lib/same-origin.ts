/**
 * Login CSRF guard for cookie-setting routes: a third-party page must not plant or clear a session.
 * Browsers send Sec-Fetch-Site on every fetch; Origin is the fallback. A request carrying neither
 * (curl, server-to-server) is not a browser CSRF vector and passes.
 */
export function isCrossSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

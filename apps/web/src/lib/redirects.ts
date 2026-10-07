/**
 * Old cabinet URLs and where they live now (ADR 0018). Served by `next.config.ts` as temporary redirects, so stored
 * notification links and bookmarks keep working; Next keeps the query string. Patterns use Next's `:param` syntax.
 */
export const LEGACY_REDIRECTS: { source: string; destination: string }[] = [
  { source: "/admin", destination: "/console" },
  { source: "/arranger", destination: "/console" },
  { source: "/arranger/applications/:id", destination: "/console/applications/:id" },
  { source: "/arranger/investors", destination: "/console/investors" },
  { source: "/arranger/pools", destination: "/console/pools" },
  { source: "/arranger/pools/:id", destination: "/console/pools/:id" },
  { source: "/arranger/roles", destination: "/console/team" },
  { source: "/arranger/audit", destination: "/console/audit" },
  { source: "/arranger/treasury", destination: "/console/settings" },
  { source: "/compliance", destination: "/console/issuers" },
  { source: "/compliance/investors", destination: "/console/investors" },
  { source: "/compliance/limits", destination: "/console/investors/limits" },
  { source: "/scas", destination: "/console/verification" },
  { source: "/scas/pools/:id", destination: "/console/verification/pools/:id" },
  { source: "/elevator", destination: "/console/delivery" },
  { source: "/regulator", destination: "/console/registry" },
  { source: "/regulator/pools/:id", destination: "/console/registry/pools/:id" },
  { source: "/regulator/events", destination: "/console/registry/events" },
  { source: "/investor", destination: "/invest" },
  { source: "/portfolio", destination: "/invest/portfolio" },
  { source: "/investor/onboarding", destination: "/invest/account" },
  { source: "/investor/pools/:id", destination: "/invest/pools/:id" },
  { source: "/farmer", destination: "/issuer" },
  { source: "/farmer/onboarding", destination: "/issuer/company" },
  { source: "/farmer/applications", destination: "/issuer/applications" },
  { source: "/farmer/applications/:id", destination: "/issuer/applications/:id" },
];

/** The new path for an old one, or null. Same matching as Next for these patterns (whole segments, `:param`). */
export function resolveLegacy(path: string): string | null {
  const parts = path.replace(/\/+$/, "").split("/");
  for (const r of LEGACY_REDIRECTS) {
    const pat = r.source.split("/");
    if (pat.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (pat.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = parts[i]!), parts[i] !== "") : p === parts[i]))) {
      return r.destination.replace(/:(\w+)/g, (_, k: string) => params[k] ?? "");
    }
  }
  return null;
}

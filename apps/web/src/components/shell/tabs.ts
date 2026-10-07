export type AppTab = { href: string; label: string };

/** Investor app tabs (spec §7). The first tab is the overview: active only on its own path. */
export const INVEST_TABS: AppTab[] = [
  { href: "/invest", label: "Overview" },
  { href: "/invest/opportunities", label: "Opportunities" },
  { href: "/invest/portfolio", label: "Portfolio" },
  { href: "/invest/activity", label: "Activity" },
  { href: "/invest/account", label: "Account" },
];

/** Issuer workspace tabs (spec §8). */
export const ISSUER_TABS: AppTab[] = [
  { href: "/issuer", label: "Overview" },
  { href: "/issuer/applications", label: "Applications" },
  { href: "/issuer/obligations", label: "Obligations" },
  { href: "/issuer/company", label: "Company" },
];

export const tabActive = (tabs: AppTab[], i: number, path: string) => {
  const t = tabs[i]!;
  return i === 0 ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
};

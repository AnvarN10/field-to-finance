"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type CabinetTab = { href: string; label: string };

/** Tabs under the cabinet title. The first tab is the overview: active only on its own path, the others also on sub-pages. */
export function CabinetNav({ tabs }: { tabs: CabinetTab[] }) {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Cabinet" className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t, i) => {
        const active = i === 0 ? path === t.href : path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-t-md border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors duration-150 ${
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

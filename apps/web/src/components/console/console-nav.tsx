"use client";

import { BadgeCheck, ClipboardList, FileClock, Inbox, Landmark, Layers, Scale, Settings, Truck, UserRoundCheck, Users, Wheat, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ConsoleIcon, ConsoleNavItem } from "./nav-items";

const ICONS: Record<ConsoleIcon, LucideIcon> = {
  inbox: Inbox,
  applications: ClipboardList,
  issuers: Wheat,
  investors: UserRoundCheck,
  pools: Layers,
  settlement: Scale,
  verification: BadgeCheck,
  delivery: Truck,
  registry: Landmark,
  audit: FileClock,
  team: Users,
  settings: Settings,
};

const isActive = (path: string, href: string) => (href === "/console" ? path === href : path === href || path.startsWith(`${href}/`));

/** The console's left navigation; items are already filtered by the user's permissions. */
export function ConsoleNav({ items, onNavigate }: { items: ConsoleNavItem[]; onNavigate?: () => void }) {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Console" className="flex flex-col gap-0.5">
      {items.map((i) => {
        const active = isActive(path, i.href);
        const Icon = ICONS[i.icon];
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150 ${
              active
                ? "bg-raised font-medium text-foreground before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:bg-primary"
                : "text-muted-foreground [@media(hover:hover)]:hover:bg-hover [@media(hover:hover)]:hover:text-foreground"
            }`}
          >
            <Icon aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

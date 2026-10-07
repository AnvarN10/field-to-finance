"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Role } from "../../lib/db/schema";
import { NotificationBell } from "../cabinet/notification-bell";
import { LogoMark } from "../logo-mark";
import { AccountMenu } from "./account-menu";
import { tabActive, type AppTab } from "./tabs";

function Tabs({ tabs, label, className, scroller = false }: { tabs: AppTab[]; label: string; className: string; scroller?: boolean }) {
  const path = usePathname() ?? "";
  const ref = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });

  // In the phone row: bring the current tab into view and fade only the edges that hide more tabs.
  useEffect(() => {
    const nav = ref.current;
    if (!scroller || !nav) return;
    nav.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
    const update = () => setEdge({ start: nav.scrollLeft > 1, end: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1 });
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [scroller, path]);

  const fade = scroller
    ? edge.start && edge.end
      ? "[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]"
      : edge.end
        ? "[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]"
        : edge.start
          ? "[mask-image:linear-gradient(to_right,transparent,black_2rem)]"
          : ""
    : "";

  return (
    <nav ref={ref} aria-label={label} className={`${className} ${fade}`}>
      {tabs.map((t, i) => {
        const active = tabActive(tabs, i, path);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-14 shrink-0 items-center border-b-2 text-sm whitespace-nowrap transition-colors duration-150 ${scroller ? "px-2.5" : "px-3"} ${
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

/**
 * Top bar of the investor app and the issuer workspace (ADR 0018): logo to the app's overview, the app's own tabs,
 * notifications and the account menu. Under 768px the tabs move to a scrolling row below the bar.
 */
export function AppHeader({ home, label, tabs, email, roles }: { home: string; label: string; tabs: AppTab[]; email: string | null; roles: readonly Role[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-6">
          <Link href={home} className="flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight">
            <LogoMark />
            <span className="max-sm:sr-only">Field-to-Finance</span>
          </Link>
          <Tabs tabs={tabs} label={label} className="-mb-px hidden items-center md:flex" />
        </div>
        {email ? (
          <div className="flex items-center gap-1">
            <NotificationBell />
            <AccountMenu email={email} roles={roles} current={home} />
          </div>
        ) : null}
      </div>
      <Tabs tabs={tabs} label={label} className="-mb-px flex overflow-x-auto border-t border-border px-2 [scrollbar-width:none] md:hidden" scroller />
    </header>
  );
}

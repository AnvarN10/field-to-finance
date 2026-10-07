"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { Role } from "../../lib/db/schema";
import { isConsoleRole, permissionsOf } from "../../lib/permissions";
import { NotificationBell } from "../cabinet/notification-bell";
import { LogoMark } from "../logo-mark";
import { AccountMenu } from "../shell/account-menu";
import { MAIN_ID } from "../skip-link";
import { ConsoleNav } from "./console-nav";
import { navFor } from "./nav-items";

/**
 * Console frame (ADR 0018): left navigation filtered by the member's permissions from 1024px, a top bar with
 * notifications and the account menu, and the navigation in a menu panel below 1024px. Without a console role
 * (`roles` has none) only the logo and the page show: the page itself explains access.
 */
export function ConsoleShell({ email, roles, children }: { email: string | null; roles: readonly Role[]; children: ReactNode }) {
  const items = navFor(permissionsOf(roles));
  const member = email !== null && roles.some(isConsoleRole);
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const brand = (
    <Link href="/console" className="flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight">
      <LogoMark />
      <span>Console</span>
    </Link>
  );

  return (
    <div className="flex min-h-dvh">
      {member ? (
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-e border-border bg-background px-3 py-4 lg:flex">
          <div className="px-3">{brand}</div>
          <ConsoleNav items={items} />
        </aside>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background">
          <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-8">
            <div className="flex items-center gap-2">
              {member ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls="console-mobile-nav"
                  onClick={() => setOpen((o) => !o)}
                  className="inline-flex size-9 items-center justify-center rounded-md active:scale-[0.98] motion-reduce:active:scale-100 lg:hidden [@media(hover:hover)]:hover:bg-hover"
                >
                  {open ? <X aria-hidden strokeWidth={1.5} className="size-5" /> : <Menu aria-hidden strokeWidth={1.5} className="size-5" />}
                  <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
                </button>
              ) : null}
              <div className={member ? "lg:hidden" : undefined}>{brand}</div>
            </div>
            {email ? (
              <div className="flex items-center gap-1">
                {member ? <NotificationBell /> : null}
                <AccountMenu email={email} roles={roles} current="/console" />
              </div>
            ) : null}
          </div>
          {open && member ? (
            <div id="console-mobile-nav" className="border-t border-border px-3 py-3 lg:hidden">
              <ConsoleNav items={items} onNavigate={() => setOpen(false)} />
            </div>
          ) : null}
        </header>
        <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8 focus:outline-none lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

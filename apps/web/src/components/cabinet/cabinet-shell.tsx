import type { ReactNode } from "react";
import { CabinetNav, type CabinetTab } from "./cabinet-nav";
import { SignOutButton } from "./sign-out-button";

/** Cabinet frame: role label, title, signed-in email, sign out, and the cabinet's tabs. Content sits below on the page ground. */
export function CabinetShell({ role, title, email, tabs, children }: { role: string; title: string; email: string; tabs: CabinetTab[]; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{role}</p>
            <h1 className="text-2xl font-semibold">{title}</h1>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate" title={email}>
              {email}
            </span>
            <SignOutButton />
          </div>
        </div>
        <CabinetNav tabs={tabs} />
      </header>
      {children}
    </div>
  );
}

import type { ReactNode } from "react";
import { currentUser } from "@/lib/server/auth";
import { AuthProvider } from "../auth/auth-provider";
import { SiteFooter } from "../site-footer";
import { MAIN_ID } from "../skip-link";
import { AppHeader } from "./app-header";
import type { AppTab } from "./tabs";

/**
 * Frame of the investor app and the issuer workspace. The header only needs the email and roles for the account menu;
 * every page still guards itself (a layout is not a security boundary).
 */
export async function AppShell({ home, label, tabs, children }: { home: string; label: string; tabs: AppTab[]; children: ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <AuthProvider>
      <AppHeader home={home} label={label} tabs={tabs} email={user?.email ?? null} roles={user?.roles ?? []} />
      <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-10 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </AuthProvider>
  );
}

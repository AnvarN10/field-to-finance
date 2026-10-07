import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ConsoleShell } from "@/components/console/console-shell";
import { currentUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: { default: "Console", template: "%s · Console · Field-to-Finance" }, robots: { index: false } };

/** The back-office console (ADR 0018). Each page guards itself with its permission; this frame only draws the navigation. */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <AuthProvider>
      <ConsoleShell email={user?.email ?? null} roles={user?.roles ?? []}>
        {children}
      </ConsoleShell>
    </AuthProvider>
  );
}

import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ISSUER_TABS } from "@/components/shell/tabs";

export default function IssuerLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell home="/issuer" label="Issuer workspace" tabs={ISSUER_TABS}>
      {children}
    </AppShell>
  );
}

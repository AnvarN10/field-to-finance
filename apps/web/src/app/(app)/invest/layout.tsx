import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { INVEST_TABS } from "@/components/shell/tabs";

export default function InvestLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell home="/invest" label="Investor app" tabs={INVEST_TABS}>
      {children}
    </AppShell>
  );
}

import type { ReactNode } from "react";
import { CabinetNav, type CabinetTab } from "../cabinet/cabinet-nav";
import { PageHeader } from "../shell/page-header";

/** A console page: title block, optional sub-tabs, content. */
export function ConsolePage({ title, description, action, tabs, children }: { title: string; description?: string; action?: ReactNode; tabs?: CabinetTab[]; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} description={description} action={action} />
        {tabs ? <CabinetNav tabs={tabs} /> : null}
      </div>
      {children}
    </div>
  );
}

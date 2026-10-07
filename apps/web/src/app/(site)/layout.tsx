import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MAIN_ID } from "@/components/skip-link";

/** Public pages and the doors: the public header (Pools, Apply for financing, Sign in, Start investing). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-10 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

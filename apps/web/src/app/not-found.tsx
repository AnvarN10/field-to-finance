import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MAIN_ID } from "@/components/skip-link";

// Rendered inside the root layout only, so it brings the public header itself.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-10 focus:outline-none">
        <div className="flex flex-col items-start gap-3">
          <h1 className="text-2xl font-semibold">Not found</h1>
          <p className="text-muted-foreground">This pool, field or page does not exist on devnet.</p>
          <Link href="/pools" className="text-primary underline underline-offset-4">
            Back to pools
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

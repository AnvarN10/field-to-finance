import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { homeFor } from "@/lib/auth/home";
import { safeNext } from "@/lib/auth/redirects";
import { currentUser } from "@/lib/server/auth";
import { SignInPanel } from "./sign-in-panel";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next ?? null);
  // Already signed in with an account: go straight home. Postgres down: still render the sign-in button.
  const user = await currentUser().catch(() => null);
  const home = user ? homeFor(user.roles) : null;
  if (home) redirect(next ?? home);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sign in to Field-to-Finance</h1>
        <p className="text-muted-foreground">One sign-in for investors, farmers and the F2F team. You land in your own app.</p>
      </header>
      <AuthProvider>
        <SignInPanel next={next} />
      </AuthProvider>
    </div>
  );
}

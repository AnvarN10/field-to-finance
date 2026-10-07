import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/components/auth/auth-provider";
import { DoorSignup } from "@/components/doors/door-signup";
import { currentUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Apply for financing" };
export const dynamic = "force-dynamic";

/** Sign-up for the issuer workspace: email, then the workspace opens on the company file. */
export default async function ApplyStart() {
  const user = await currentUser().catch(() => null);
  if (user?.roles.includes("farmer")) redirect("/issuer");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Apply for financing</h1>
        <p className="text-muted-foreground">Sign up with the email of the person who will run the application. You can save and come back at any step.</p>
      </header>
      <section aria-label="Sign up" className="flex flex-col gap-5 rounded-lg border border-border bg-card p-6">
        <AuthProvider>
          <DoorSignup door="issuer" />
        </AuthProvider>
      </section>
      <p className="text-sm text-muted-foreground">
        Already applied?{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline decoration-muted-foreground underline-offset-4">
          Sign in
        </Link>
        . Want to invest instead?{" "}
        <Link href="/invest/signup" className="font-medium text-foreground underline decoration-muted-foreground underline-offset-4">
          Start investing
        </Link>
        .
      </p>
    </div>
  );
}

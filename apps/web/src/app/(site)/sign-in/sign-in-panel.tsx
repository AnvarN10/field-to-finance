"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { homeFor } from "@/lib/auth/home";
import { safeNext } from "@/lib/auth/redirects";

const doorLink = "font-medium text-foreground underline decoration-muted-foreground underline-offset-4 [@media(hover:hover)]:hover:decoration-current";
const outlineLink =
  "inline-flex h-9 items-center rounded-md border border-input bg-card px-4 text-sm font-medium transition-colors duration-150 [@media(hover:hover)]:hover:border-muted-foreground [@media(hover:hover)]:hover:bg-raised";

/**
 * One sign-in for everyone (ADR 0018). After the server session exists the account goes home (console, issuer workspace
 * or investor app, or `next`); an email without an account sees the two doors. There is no role choice here.
 */
export function SignInPanel({ next }: { next: string | null }) {
  const auth = useAuth();
  const router = useRouter();
  const roles = auth.server.state === "ready" ? auth.server.roles : null;
  const home = roles ? homeFor(roles) : null;

  useEffect(() => {
    if (home) router.replace(safeNext(next) ?? home);
  }, [home, next, router]);

  if (auth.mode === "unconfigured") {
    return <p className="text-sm text-muted-foreground">Sign-in is not configured on this server: NEXT_PUBLIC_PRIVY_APP_ID is missing.</p>;
  }
  if (!auth.ready) return <div className="skeleton-shimmer h-24 rounded-lg" role="status" aria-label="Loading sign-in" />;

  if (!auth.authenticated) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Button type="button" size="lg" onClick={auth.login} className="h-11 px-5 text-base">
          Continue with email
        </Button>
        <p className="text-sm text-muted-foreground">We email you a one-time code.</p>
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/invest/signup" className={doorLink}>
            Start investing
          </Link>{" "}
          or{" "}
          <Link href="/apply" className={doorLink}>
            Apply for financing
          </Link>
          .
        </p>
      </div>
    );
  }

  if (auth.server.state === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive bg-card p-4 text-sm">
        <p className="font-medium">{auth.server.message}</p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => void auth.resync()}>
            Try again
          </Button>
          <Button type="button" variant="ghost" onClick={() => void auth.logout()}>
            Use another email
          </Button>
        </div>
      </div>
    );
  }

  if (!roles || home) return <p role="status" className="text-sm text-muted-foreground">{roles ? "Opening your account" : "Signing you in"}</p>;

  return (
    <div className="flex flex-col items-start gap-4">
      <h2 className="text-base font-semibold">No account for this email yet</h2>
      <p className="text-sm text-muted-foreground">{`${auth.email ?? "This email"} has no Field-to-Finance account. Open one, or sign in with the email you used before. Team members join the console through their invitation link.`}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/invest/signup" className={outlineLink}>
          Start investing
        </Link>
        <Link href="/apply" className={outlineLink}>
          Apply for financing
        </Link>
      </div>
      <Button type="button" variant="ghost" onClick={() => void auth.logout()}>
        Use another email
      </Button>
    </div>
  );
}

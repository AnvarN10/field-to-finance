"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { openAccountAction } from "../../app/(site)/doors-actions";
import type { Door } from "../../lib/workflow/accounts";
import { useAuth } from "../auth/auth-context";
import { Button } from "../ui/button";

const HOME_NAME: Record<string, string> = { "/console": "console", "/issuer": "issuer workspace", "/invest": "investor app" };
const COPY: Record<Door, { hint: string; opening: string }> = {
  investor: { hint: "We email you a one-time code. Your account comes with a secure wallet; no seed phrase, no SOL needed.", opening: "Opening your investor account" },
  issuer: { hint: "We email you a one-time code. Your company gets a secure wallet with no seed phrase; it becomes the issuer wallet of your pool.", opening: "Opening your issuer workspace" },
};

/**
 * Sign-up for one door (ADR 0018): Privy email sign-in, then the door's account opens at once and the user goes on.
 * There is no choice to make: the door already says who the user is.
 */
export function DoorSignup({ door }: { door: Door }) {
  const auth = useAuth();
  const router = useRouter();
  const [failure, setFailure] = useState<{ error: string; home: string | null } | null>(null);
  const started = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const ready = auth.server.state === "ready";

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void (async () => {
      const r = await openAccountAction(door);
      if (!r.ok) return setFailure({ error: r.error, home: r.home });
      await auth.resync();
      router.replace(r.home);
    })();
  }, [ready, door, auth, router, attempt]);

  if (auth.mode === "unconfigured") return <p className="text-sm text-muted-foreground">Sign-up is not configured on this server: NEXT_PUBLIC_PRIVY_APP_ID is missing.</p>;
  if (!auth.ready) return <div className="skeleton-shimmer h-24 rounded-lg" role="status" aria-label="Loading sign-up" />;
  if (!auth.authenticated) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Button type="button" size="lg" onClick={auth.login} className="h-11 px-5 text-base">
          Continue with email
        </Button>
        <p className="text-sm text-muted-foreground">{COPY[door].hint}</p>
      </div>
    );
  }
  const problem = failure ?? (auth.server.state === "error" ? { error: auth.server.message, home: null } : null);
  if (problem) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive bg-card p-4 text-sm">
        <p className="font-medium">{problem.error}</p>
        <div className="flex flex-wrap items-center gap-3">
          {problem.home ? (
            <Link href={problem.home} className="inline-flex h-9 items-center rounded-md border border-input bg-card px-4 font-medium [@media(hover:hover)]:hover:border-muted-foreground">
              {`Go to your ${HOME_NAME[problem.home] ?? "app"}`}
            </Link>
          ) : null}
          {failure ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                started.current = false;
                setFailure(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => void auth.logout()}>
            Use another email
          </Button>
        </div>
      </div>
    );
  }
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {ready ? COPY[door].opening : "Signing you in"}
    </p>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "./actions";

/** Sign in with the invited email, then accept; the server checks the email and uses the invitation once. */
export function AcceptInvitation({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (auth.mode === "unconfigured") return <p className="text-sm text-muted-foreground">Sign-in is not configured on this server.</p>;
  if (!auth.ready) return <div className="skeleton-shimmer h-11 w-48 rounded-md" role="status" aria-label="Loading sign-in" />;
  if (!auth.authenticated) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Button type="button" size="lg" onClick={auth.login} className="h-11 px-5 text-base">
          Continue with email
        </Button>
        <p className="text-sm text-muted-foreground">{`Sign in with ${maskedEmail}, the address this invitation was sent to.`}</p>
      </div>
    );
  }
  if (auth.server.state === "error") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 text-sm">
        <p className="font-medium">{auth.server.message}</p>
        <Button type="button" variant="outline" onClick={() => void auth.resync()}>
          Try again
        </Button>
      </div>
    );
  }
  const ready = auth.server.state === "ready";
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">{`Signed in as ${auth.email ?? "your email"}.`}</p>
      <Button
        type="button"
        size="lg"
        className="h-11 px-5 text-base"
        disabled={!ready || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await acceptInvitationAction(token);
            if (!r.ok) return setError(r.error);
            await auth.resync();
            router.replace("/console");
          })
        }
      >
        {pending ? "Joining the console" : ready ? "Accept invitation" : "Signing you in"}
      </Button>
      {error ? (
        <div role="alert" className="flex flex-col items-start gap-2 text-sm">
          <p className="text-destructive">{error}</p>
          <Button type="button" variant="ghost" onClick={() => void auth.logout()}>
            Use another email
          </Button>
        </div>
      ) : null}
    </div>
  );
}

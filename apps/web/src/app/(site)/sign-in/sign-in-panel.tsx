"use client";

import { Sprout, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { cabinetFor, safeNext } from "@/lib/auth/redirects";
import { chooseRoleAction } from "./actions";

const CHOICES = [
  { role: "farmer", label: "I am a farmer", body: "Raise working capital against part of next season's harvest.", Icon: Sprout },
  { role: "investor", label: "I am an investor", body: "Buy fixed-coupon harvest instruments with USDC.", Icon: TrendingUp },
] as const;

export function SignInPanel({ next }: { next: string | null }) {
  const auth = useAuth();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const roles = auth.server.state === "ready" ? auth.server.roles : null;

  useEffect(() => {
    if (!roles || roles.length === 0) return;
    router.replace(safeNext(next) ?? cabinetFor(roles) ?? "/");
  }, [roles, next, router]);

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
        <p className="text-sm text-muted-foreground">We email you a one-time code. Farmers get a secure wallet with no seed phrase.</p>
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

  if (!roles || roles.length > 0) return <p role="status" className="text-sm text-muted-foreground">{roles ? "Opening your cabinet" : "Signing you in"}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{`Signed in as ${auth.email ?? "your email"}. How will you use Field-to-Finance?`}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHOICES.map(({ role, label, body, Icon }) => (
          <button
            key={role}
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await chooseRoleAction(role);
                if (!r.ok) return setError(r.error);
                await auth.resync();
                router.replace(cabinetFor(r.roles) ?? "/");
              })
            }
            className="flex min-h-28 flex-col items-start gap-2 rounded-lg border border-input bg-card p-4 text-left transition-[border-color,background-color,scale] duration-150 ease-(--ease-out) active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100 [@media(hover:hover)]:hover:border-muted-foreground [@media(hover:hover)]:hover:bg-raised"
          >
            <Icon aria-hidden strokeWidth={1.5} className="size-5 text-primary" />
            <span className="text-base font-semibold">{label}</span>
            <span className="text-sm text-muted-foreground">{body}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Arrangers are added by the F2F team. Ask an arranger if you need that access.</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import { AuthContext } from "../auth/auth-context";
import { Button } from "../ui/button";

export function SignOutButton() {
  // Works outside the Privy provider too: clearing the session cookie is enough to sign out of the platform.
  const auth = useContext(AuthContext);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        if (auth) await auth.logout();
        else await fetch("/api/session", { method: "DELETE" }).catch(() => null);
        router.replace("/sign-in");
        router.refresh();
      }}
    >
      {busy ? "Signing out" : "Sign out"}
    </Button>
  );
}

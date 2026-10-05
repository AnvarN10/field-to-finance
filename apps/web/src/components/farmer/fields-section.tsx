"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { attachProjectAction } from "../../app/farmer/actions";
import { useAuth } from "../auth/auth-context";
import { RegisterFields } from "./register-fields";

/** Fields step of an application: register with the farmer's Privy wallet, then link the project to the application. */
export function FieldsSection({
  applicationId,
  application,
  mintFee,
  maxArrangementBps,
}: {
  applicationId: string;
  application: { crop: string; season: number; volumeT: number; requestedUsd: number };
  mintFee: string | null;
  maxArrangementBps: number | null;
}) {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!auth.ready) return <div className="skeleton-shimmer h-24 rounded-lg" role="status" aria-label="Loading your wallet" />;
  if (!auth.authenticated) {
    return (
      <div className="flex flex-col items-start gap-3 text-sm">
        <p className="text-muted-foreground">Your wallet signs the registration. Confirm your sign-in to unlock it.</p>
        <Button type="button" variant="outline" onClick={auth.login}>
          Confirm sign-in
        </Button>
      </div>
    );
  }
  if (!auth.signer) return <p className="text-sm text-muted-foreground">Your wallet is being created. This takes a few seconds; reload the page if it does not appear.</p>;
  return (
    <div className="flex flex-col gap-3">
      <RegisterFields
        signer={auth.signer}
        application={application}
        mintFee={mintFee}
        maxArrangementBps={maxArrangementBps}
        onRegistered={async (project, fields) => {
          const r = await attachProjectAction(applicationId, project, fields);
          if (r.ok) router.refresh();
          else setError(r.error);
        }}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

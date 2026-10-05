"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { submitApplicationAction, withdrawApplicationAction } from "../../app/farmer/actions";
import { Button } from "../ui/button";

export function ApplicationActions({ applicationId, canSubmit, canWithdraw }: { applicationId: string; canSubmit: boolean; canWithdraw: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = () => {
    setConfirming(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else setError(r.error);
      setConfirming(false);
    });
  if (!canSubmit && !canWithdraw) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {canSubmit ? (
          <Button type="button" size="lg" disabled={pending} onClick={() => run(() => submitApplicationAction(applicationId))}>
            {pending ? "Submitting" : "Submit for review"}
          </Button>
        ) : null}
        {canWithdraw && !confirming ? (
          <Button ref={trigger} type="button" variant="outline" disabled={pending} onClick={() => setConfirming(true)}>
            Withdraw application
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
          <span className="mr-auto">Withdraw this application? The arranger stops working on it and it cannot be reopened.</span>
          <Button autoFocus type="button" variant="destructive" size="sm" disabled={pending} onClick={() => run(() => withdrawApplicationAction(applicationId))}>
            Yes, withdraw
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={cancel}>
            Cancel
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

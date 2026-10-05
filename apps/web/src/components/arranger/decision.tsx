"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { ActionResult } from "../../app/arranger/actions";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ActionResultView } from "./action-result";

/** Approve or reject with a reason: the reason is required for a rejection and reaches the farmer or investor. */
export function Decision({
  approveLabel,
  rejectLabel = "Reject",
  approve,
  reject,
  signedBy,
}: {
  approveLabel: string;
  rejectLabel?: string;
  approve: () => Promise<ActionResult>;
  reject: (reason: string) => Promise<ActionResult>;
  signedBy?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const go = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(null);
      const r = await fn();
      setResult(r);
      if (r.ok) {
        setRejecting(false);
        router.refresh();
      }
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => go(approve)}>
          {pending && !rejecting ? `${approveLabel}…` : approveLabel}
        </Button>
        {!rejecting ? (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(true)}>
            {rejectLabel}
          </Button>
        ) : null}
        {signedBy ? <span className="text-xs text-muted-foreground">{`Signed by ${signedBy}`}</span> : null}
      </div>
      {rejecting ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => reject(reason));
          }}
        >
          <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium">
            Reason (sent to the user)
            <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="h-9" />
          </label>
          <Button type="submit" size="sm" variant="destructive" disabled={pending || reason.trim().length < 3}>
            {`Yes, ${rejectLabel.toLowerCase()}`}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
        </form>
      ) : null}
      <ActionResultView result={result} />
    </div>
  );
}

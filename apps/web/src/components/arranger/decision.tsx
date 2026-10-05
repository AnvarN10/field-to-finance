"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
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
  const [invalid, setInvalid] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = () => {
    setRejecting(false);
    setInvalid(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
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
          <Button ref={trigger} type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(true)}>
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
            if (reason.trim().length < 3) return setInvalid(true);
            go(() => reject(reason));
          }}
        >
          <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium">
            Reason (sent to the user)
            <Input
              id={id}
              autoFocus
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (invalid && e.target.value.trim().length >= 3) setInvalid(false);
              }}
              maxLength={300}
              className="h-9"
              aria-invalid={invalid || undefined}
              aria-describedby={`${id}-hint`}
            />
          </label>
          <Button type="submit" size="sm" variant="destructive" disabled={pending}>
            {`Yes, ${rejectLabel.toLowerCase()}`}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          <p id={`${id}-hint`} className={`basis-full text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}>
            Write at least 3 characters so they know what to fix.
          </p>
        </form>
      ) : null}
      <ActionResultView result={result} />
    </div>
  );
}

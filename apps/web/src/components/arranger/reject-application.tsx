"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "../../app/console/_actions/pools";
import { rejectAction } from "../../app/console/_actions/applications";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ActionResultView } from "./action-result";

export function RejectApplication({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [invalid, setInvalid] = useState(false);
  const hintId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    setInvalid(false);
    // Focus goes back to the button that opened the form.
    requestAnimationFrame(() => trigger.current?.focus());
  };
  if (!open)
    return (
      <Button ref={trigger} type="button" variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        Reject application
      </Button>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length < 3) return setInvalid(true);
        start(async () => {
          const r = await rejectAction(applicationId, reason);
          setResult(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Reason for the farmer
        <Input
          autoFocus
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (invalid && e.target.value.trim().length >= 3) setInvalid(false);
          }}
          maxLength={300}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
        />
      </label>
      <p id={hintId} className={`text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}>
        Write at least 3 characters so the farmer knows what to fix.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          Yes, reject the application
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={close}>
          Cancel
        </Button>
      </div>
      <ActionResultView result={result} />
    </form>
  );
}

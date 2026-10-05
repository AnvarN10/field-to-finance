"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "../../app/arranger/actions";
import { rejectAction } from "../../app/arranger/workflow-actions";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ActionResultView } from "./action-result";

export function RejectApplication({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  if (!open)
    return (
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setOpen(true)}>
        Reject application
      </Button>
    );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await rejectAction(applicationId, reason);
          setResult(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Reason for the farmer
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" size="sm" disabled={pending || reason.trim().length < 3}>
          Yes, reject the application
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <ActionResultView result={result} />
    </form>
  );
}

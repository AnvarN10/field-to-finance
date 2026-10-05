"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "../../app/arranger/actions";
import { ActionResultView } from "../arranger/action-result";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/** Revoke an approved KYC: the reason is required, the confirm button names the consequence (holdings freeze). */
export function RevokeKyc({ revoke }: { revoke: (reason: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <Button ref={trigger} type="button" size="sm" variant="outline" className="self-start" onClick={() => setOpen(true)}>
          Revoke KYC
        </Button>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < 3) return setInvalid(true);
            start(async () => {
              const r = await revoke(reason.trim());
              setResult(r);
              if (r.ok) {
                setOpen(false);
                router.refresh();
              }
            });
          }}
        >
          <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium">
            Reason (sent to the investor)
            <Input id={id} autoFocus value={reason} maxLength={300} className="h-9" aria-invalid={invalid || undefined} aria-describedby={`${id}-hint`} onChange={(e) => { setReason(e.target.value); if (invalid && e.target.value.trim().length >= 3) setInvalid(false); }} />
          </label>
          <Button type="submit" size="sm" variant="destructive" disabled={pending}>
            Yes, revoke and freeze holdings
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setInvalid(false); requestAnimationFrame(() => trigger.current?.focus()); }}>
            Cancel
          </Button>
          <p id={`${id}-hint`} className={`basis-full text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}>
            Every linked wallet is revoked on-chain and its Instrument accounts freeze. New subscriptions stop at once.
          </p>
        </form>
      )}
      <ActionResultView result={result} />
    </div>
  );
}

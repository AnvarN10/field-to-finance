"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "../../app/console/_actions/pools";
import { ExplorerLink } from "../explorer-link";
import { TxStatus } from "../tx/tx-status";
import { Button } from "../ui/button";

export function ActionButton({
  label,
  role,
  action,
  confirmText,
  disabled,
  disabledReason,
  variant = "default",
  hideRole = false,
}: {
  label: string;
  role: "Issuer" | "Arranger" | "Compliance" | "SCAS stub" | "SCAS" | "Platform" | "Deployer" | "Anyone";
  action: () => Promise<ActionResult>;
  confirmText?: string;
  disabled?: boolean;
  disabledReason?: string;
  /** `outline` for secondary or destructive actions, so wheat stays on the one primary action. */
  variant?: "default" | "outline";
  /** Hide "Signed by" when the page states the signer once for a whole list. */
  hideRole?: boolean;
}) {
  const router = useRouter();
  const reasonId = useId();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Move focus into the confirmation so keyboard and screen-reader users know it opened.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const go = () =>
    start(async () => {
      setConfirming(false);
      setResult(null);
      const r = await action();
      setResult(r);
      if (r.ok) router.refresh();
    });

  const showReason = Boolean(disabled && disabledReason);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          variant={variant}
          disabled={disabled || pending}
          aria-describedby={showReason ? reasonId : undefined}
          onClick={() => (confirmText ? setConfirming(true) : go())}
          className="h-auto min-h-9 py-1.5 text-left whitespace-normal"
        >
          {pending ? `${label}…` : label}
        </Button>
        {hideRole ? null : <span className="text-xs text-muted-foreground">Signed by {role}</span>}
      </div>
      {showReason ? (
        <p id={reasonId} className="text-xs text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
          <span className="mr-auto">{confirmText}</span>
          <Button ref={confirmRef} type="button" variant="destructive" size="sm" onClick={go}>
            {`Yes, ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : null}
      {result?.ok ? (
        <div role="status" className="flex flex-col gap-1 text-sm duration-200 ease-(--ease-out) animate-in fade-in-0">
          <p className="flex items-center gap-1.5 font-medium text-success">
            <CircleCheck aria-hidden strokeWidth={1.5} className="size-4" />
            {result.message}
          </p>
          {result.signatures.length ? (
            <div className="flex flex-wrap gap-3">
              {result.signatures.map((s) => (
                <ExplorerLink key={s} kind="tx" value={s} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {result && !result.ok ? <TxStatus state={{ phase: "error", error: result.error, logs: result.logs }} /> : null}
    </div>
  );
}

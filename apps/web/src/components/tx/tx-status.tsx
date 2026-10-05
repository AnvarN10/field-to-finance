"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import type { ErrorAction } from "../../lib/chain/explain";
import type { TxPhase } from "../../lib/tx-client";
import { ExplorerLink } from "../explorer-link";

const ACTION_LABEL: Partial<Record<ErrorAction, string>> = {
  kyc: "Complete KYC",
  faucet: "Get test funds",
  retry: "Try again",
  onboarding: "Finish onboarding",
  kfd: "Read the key features",
};
const PENDING: Record<"building" | "signing" | "confirming", string> = {
  building: "Preparing transaction",
  signing: "Approve in your wallet",
  confirming: "Confirming on devnet",
};

/**
 * The polite status region stays mounted (empty while idle), so screen readers announce each phase change;
 * a region inserted together with its text is often not announced. Errors use a separate role="alert".
 */
export function TxStatus({ state, onAction, successLabel = "Confirmed on devnet" }: { state: TxPhase; onAction?: (a: ErrorAction) => void; successLabel?: string }) {
  const pending = state.phase === "building" || state.phase === "signing" || state.phase === "confirming";
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="empty:hidden">
        {pending ? (
          <div className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden strokeWidth={1.5} className="size-4 animate-spin motion-reduce:animate-none" />
            <span>{PENDING[state.phase]}</span>
            {state.phase === "confirming" ? <ExplorerLink kind="tx" value={state.signature} /> : null}
          </div>
        ) : state.phase === "success" ? (
          <div className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-success">
            <DrawnCheck />
            <span className="font-medium">{successLabel}</span>
            <span className="tx-link-in">
              <ExplorerLink kind="tx" value={state.signature} />
            </span>
          </div>
        ) : null}
      </div>
      {state.phase === "error" ? <TxError state={state} onAction={onAction} /> : null}
    </>
  );
}

/**
 * Success mark that draws itself once when the success row mounts: circle 320ms, then the tick
 * (globals.css .check-draw-*). With reduced motion it appears complete.
 */
export function DrawnCheck() {
  return (
    <svg data-slot="drawn-check" viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" pathLength={1} className="check-draw-circle" transform="rotate(-90 12 12)" />
      <path d="m8 12.5 2.7 2.7L16 9.8" pathLength={1} className="check-draw-tick" />
    </svg>
  );
}

function TxError({ state, onAction }: { state: Extract<TxPhase, { phase: "error" }>; onAction?: (a: ErrorAction) => void }) {
  const label = ACTION_LABEL[state.error.action];
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive bg-card p-4 text-sm animate-in fade-in-0 duration-200 ease-(--ease-out)">
      <div className="flex items-start gap-2">
        <TriangleAlert aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-foreground">{state.error.title}</p>
          {state.error.detail ? <p className="text-muted-foreground">{state.error.detail}</p> : null}
          {state.signature ? (
            <p className="text-muted-foreground">
              Failed transaction: <ExplorerLink kind="tx" value={state.signature} />
            </p>
          ) : null}
        </div>
      </div>
      {label && onAction ? (
        <button
          type="button"
          onClick={() => onAction(state.error.action)}
          className="self-start rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground transition-[background-color,scale] duration-100 ease-(--ease-out) hover:bg-primary-hover active:scale-[0.98] motion-reduce:active:scale-100"
        >
          {label}
        </button>
      ) : null}
      {state.logs.length ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Program logs</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-background p-2 font-mono whitespace-pre-wrap">{state.logs.join("\n")}</pre>
        </details>
      ) : null}
    </div>
  );
}

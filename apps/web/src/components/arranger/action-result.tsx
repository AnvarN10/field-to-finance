"use client";

import { CircleCheck } from "lucide-react";
import type { ActionResult } from "../../app/console/_actions/pools";
import { ExplorerLink } from "../explorer-link";
import { TxStatus } from "../tx/tx-status";

/** Outcome of an arranger action: message plus explorer links, or the explained error. */
export function ActionResultView({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (!result.ok) return <TxStatus state={{ phase: "error", error: result.error, logs: result.logs }} />;
  return (
    <div role="status" className="flex flex-col gap-1 text-sm">
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
  );
}

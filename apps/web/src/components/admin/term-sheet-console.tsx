"use client";

import { useId, useRef, useState } from "react";
import { electSettlementAction, recordDeliveryAction } from "../../app/admin/actions";
import type { InstrumentTermsView, PoolView } from "../../lib/chain/views";
import { formatTonnes } from "../../lib/format";
import { settlementStatus } from "../../lib/instrument-terms";
import { ActionButton } from "./action-button";

const selectClass =
  "h-9 min-w-0 rounded-md border border-input bg-card px-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Admin controls for a pool with InstrumentTerms (ADR 0014): settlement election and delivery documents. */
export function TermSheetConsole({ pool, terms, now }: { pool: PoolView; terms: InstrumentTermsView; now: number }) {
  const status = settlementStatus(pool, terms, now);
  const hybrid = terms.settlementMode === "Hybrid";
  const delivery = terms.settlementMode !== "CashBuyback";
  const electBlocker =
    terms.election !== null
      ? "Already elected"
      : now > pool.maturityTs
        ? "The election closed at maturity; delivery applies"
        : pool.status !== "Open" && pool.status !== "Funded"
          ? "Needs an Open or Funded pool"
          : undefined;
  const deliveryBlocker =
    pool.status !== "Funded" ? "Needs a Funded pool" : status.election === "Buyback" ? "The issuer elected buyback" : undefined;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">5. Term sheet settlement</h3>
      <p className="text-sm text-muted-foreground">{status.label}</p>
      {hybrid ? (
        <div className="flex flex-col gap-3">
          <ActionButton label="Elect buyback" role="Arranger" action={electSettlementAction.bind(null, pool.poolId, "Buyback")} disabled={electBlocker !== undefined} disabledReason={electBlocker} />
          <ActionButton
            label="Elect delivery"
            role="Arranger"
            action={electSettlementAction.bind(null, pool.poolId, "Delivery")}
            confirmText="Delivery is final: holders claim grain instead of cash. Elect delivery?"
            disabled={electBlocker !== undefined}
            disabledReason={electBlocker}
          />
        </div>
      ) : null}
      {delivery ? <DeliveryForm poolId={pool.poolId} blocker={deliveryBlocker} terms={terms} /> : null}
    </div>
  );
}

function DeliveryForm({ poolId, blocker, terms }: { poolId: string; blocker: string | undefined; terms: InstrumentTermsView }) {
  const [kind, setKind] = useState<"ElevatorReceipt" | "LabQuality">("ElevatorReceipt");
  const [verdict, setVerdict] = useState("Pass");
  const [tonnes, setTonnes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const base = useId();
  const titleId = `${base}-title`;

  async function submit() {
    if (!file) {
      setError("Choose the receipt or certificate file");
      fileRef.current?.focus();
      return { ok: false as const, error: { code: "BadRequest", title: "Choose a file", detail: "", action: "none" as const }, logs: [] };
    }
    setError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("verdict", verdict);
    if (tonnes.trim()) fd.set("tonnes", tonnes.trim());
    fd.set("file", file);
    return recordDeliveryAction(poolId, fd);
  }

  return (
    <form aria-labelledby={titleId} className="flex flex-col gap-3 border-t border-border pt-3" onSubmit={(e) => e.preventDefault()}>
      <p id={titleId} className="text-sm font-medium">
        Record delivery document
      </p>
      <p className="text-xs text-muted-foreground">{`Receipt ${terms.receiptHash ? "recorded" : "missing"}, lab certificate ${terms.labPassed ? "passed" : terms.labCertHash ? "did not pass" : "missing"}. Claimed so far ${formatTonnes(terms.deliveredKg)}.`}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Document
          <select className={selectClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="ElevatorReceipt">{`Elevator receipt (${terms.elevator})`}</option>
            <option value="LabQuality">{`Lab certificate (${terms.lab})`}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Verdict
          <select className={selectClass} value={verdict} onChange={(e) => setVerdict(e.target.value)}>
            <option value="Pass">Pass</option>
            <option value="Fail">Fail</option>
            <option value="InsufficientData">Insufficient data</option>
          </select>
        </label>
        {kind === "ElevatorReceipt" ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Tonnes received
            <input inputMode="numeric" value={tonnes} onChange={(e) => setTonnes(e.target.value)} className={`${selectClass} tabular`} />
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          File
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            className="max-w-full text-sm font-normal text-muted-foreground file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-card file:px-3 file:text-sm file:font-medium file:text-foreground"
          />
        </label>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">The file stays private to this console; its hash and a public evidence record go on-chain.</p>
      <ActionButton
        label={kind === "ElevatorReceipt" ? "Record elevator receipt" : "Record lab certificate"}
        role="Arranger"
        action={submit}
        disabled={blocker !== undefined}
        disabledReason={blocker}
      />
    </form>
  );
}

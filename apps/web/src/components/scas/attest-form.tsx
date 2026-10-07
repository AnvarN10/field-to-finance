"use client";

import { useId, useRef, useState } from "react";
import { attestAction } from "../../app/console/_actions/verification";
import { ActionButton } from "../admin/action-button";
import { fileInputClass } from "../elevator/receipt-form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

const select =
  "h-10 min-w-0 rounded-md border border-input bg-card px-2.5 text-base font-normal md:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Season attestation by the SCAS partner: stage, observation, optional evidence file, yield estimate before harvest. */
export function AttestForm({ poolId, blocker }: { poolId: string; blocker: string | undefined }) {
  const id = useId();
  const [kind, setKind] = useState("Vegetation");
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} aria-labelledby={`${id}-title`} className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <h2 id={`${id}-title`} className="text-base font-semibold">
        Record a season attestation
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Stage
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={select}>
            <option value="Sowing">Sowing</option>
            <option value="Vegetation">Vegetation</option>
            <option value="Harvest">Yield estimate (pre-harvest)</option>
          </select>
        </label>
        {kind === "Harvest" ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Yield estimate, t/ha
            <Input name="yield" inputMode="decimal" className="tabular h-10" autoComplete="off" />
          </label>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Observation
          <Textarea name="note" maxLength={500} rows={3} placeholder="What the imagery or the field visit showed" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Evidence file (optional)
          <input type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" className={fileInputClass} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">One attestation per field of the pool, signed by the SCAS key. The file stays private; its hash goes into the public evidence record.</p>
      <ActionButton label="Record attestation" role="SCAS" action={() => attestAction(poolId, new FormData(form.current ?? undefined))} disabled={blocker !== undefined} disabledReason={blocker} />
    </form>
  );
}

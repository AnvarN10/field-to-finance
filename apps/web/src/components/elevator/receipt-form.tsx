"use client";

import { useId, useRef } from "react";
import { recordReceiptAction } from "../../app/elevator/actions";
import { ActionButton } from "../admin/action-button";
import { Input } from "../ui/input";

export const fileInputClass =
  "max-w-full text-sm font-normal text-muted-foreground file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-card file:px-3 file:text-sm file:font-medium file:text-foreground";

/** Elevator receipt: tonnes received, receipt number (hashed before it leaves the server), receiving date, receipt file. */
export function ReceiptForm({ poolId, elevator, blocker }: { poolId: string; elevator: string; blocker?: string }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} aria-labelledby={`${id}-t`} className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <h3 id={`${id}-t`} className="text-sm font-semibold">{`Elevator receipt · ${elevator}`}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tonnes received
          <Input name="tonnes" inputMode="numeric" autoComplete="off" className="tabular h-10" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Receipt number
          <Input name="receiptNumber" autoComplete="off" maxLength={64} className="h-10" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Received on
          <Input name="receivedOn" type="date" className="tabular h-10" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-3">
          Receipt file
          <input type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" className={fileInputClass} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Only a hash of the receipt number is stored. The file stays private; its hash and the tonnes go into the public evidence record.</p>
      <ActionButton label="Record receipt" role="Platform" action={() => recordReceiptAction(poolId, new FormData(form.current ?? undefined))} disabled={blocker !== undefined} disabledReason={blocker} />
    </form>
  );
}

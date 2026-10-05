"use client";

import type { QualitySpec } from "@f2f/sdk";
import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { useId, useRef, useState } from "react";
import { recordLabAction } from "../../app/elevator/actions";
import { evaluateLab } from "../../lib/lab-quality";
import { ActionButton } from "../admin/action-button";
import { Input } from "../ui/input";
import { fileInputClass } from "./receipt-form";

const VERDICT: Record<string, string> = { Pass: "passes the spec", Fail: "does not pass the spec", InsufficientData: "insufficient data" };

/** Lab protocol against the pool's 12-parameter spec: the requirement beside each input, pass or fail computed live. */
export function LabForm({ poolId, spec, blocker, secondary = false }: { poolId: string; spec: QualitySpec; blocker?: string; secondary?: boolean }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const { results, verdict } = evaluateLab(spec, values);
  return (
    <form ref={form} aria-labelledby={`${id}-t`} className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <h3 id={`${id}-t`} className="text-sm font-semibold">{`Lab protocol · ${spec.crop}, ${spec.class}`}</h3>
      <div className="relative overflow-x-auto" role="region" aria-label="Quality parameters" tabIndex={0}>
        <table className="tabular w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Parameter</th>
              <th className="py-2 pr-3 font-medium max-sm:hidden">Requirement</th>
              <th className="py-2 pr-3 font-medium">Measured</th>
              <th className="py-2 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const Icon = r.pass === true ? CircleCheck : r.pass === false ? CircleX : CircleDashed;
              return (
                <tr key={r.key} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <label htmlFor={`${id}-${r.key}`}>{r.label}</label>
                    <span id={`${id}-${r.key}-req`} className="block text-xs whitespace-nowrap text-muted-foreground sm:hidden">
                      {r.requirement}
                    </span>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground max-sm:hidden">{r.requirement}</td>
                  <td className="py-2 pr-3">
                    <Input id={`${id}-${r.key}`} name={r.key} autoComplete="off" maxLength={40} aria-describedby={`${id}-${r.key}-req`} className="h-9 w-24 sm:w-32" value={values[r.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))} />
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 ${r.pass === true ? "text-success" : r.pass === false ? "text-destructive" : "text-muted-foreground"}`}>
                      <Icon aria-hidden strokeWidth={1.5} className="size-4" />
                      <span className="max-sm:sr-only">{r.pass === true ? "Passes" : r.pass === false ? "Fails" : "Waiting"}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm font-medium" aria-live="polite">{`Verdict: ${VERDICT[verdict]}`}</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Protocol file
        <input type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" className={fileInputClass} />
      </label>
      <ActionButton label="Record lab protocol" role="Platform" variant={secondary ? "outline" : "default"} action={() => recordLabAction(poolId, new FormData(form.current ?? undefined))} disabled={blocker !== undefined} disabledReason={blocker} />
    </form>
  );
}

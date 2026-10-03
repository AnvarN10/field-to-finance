"use client";

import { useId, useState } from "react";
import { createPoolAction } from "../../app/admin/actions";
import { Input } from "../ui/input";
import { ActionButton } from "./action-button";

const toBps = (pct: string) => Math.round(Number(pct) * 100);

type Values = {
  poolId: string;
  crop: string;
  season: string;
  name: string;
  symbol: string;
  yieldPct: string;
  premiumPct: string;
  arrangementPct: string;
  closeIn: string;
  maturityIn: string;
};

/** `maxArrangementBps`: FeeConfig cap, or null while fees are not configured (the fee is then fixed at 0). */
export function CreatePoolForm({ defaultPoolId, maxArrangementBps }: { defaultPoolId: string; maxArrangementBps: number | null }) {
  const [v, setV] = useState<Values>({
    poolId: defaultPoolId,
    crop: "wheat",
    season: "2027",
    name: "Wheat 2027",
    symbol: "WHEAT-2027",
    yieldPct: "8.0",
    premiumPct: "5.5",
    // ADR 0013 demo default: 2% arrangement fee, paid by the farmer.
    arrangementPct: maxArrangementBps === null ? "0.0" : (Math.min(200, maxArrangementBps) / 100).toFixed(1),
    closeIn: "10",
    maturityIn: "20",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const base = useId();
  const idOf = (k: keyof Values) => `${base}-${k}`;
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const field = (k: keyof Values, label: string, numeric = false, opts: { hint?: string; disabled?: boolean } = {}) => (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor={idOf(k)}>{label}</label>
      <Input
        id={idOf(k)}
        value={v[k]}
        onChange={set(k)}
        disabled={opts.disabled}
        inputMode={numeric ? "decimal" : undefined}
        className={numeric ? "tabular" : undefined}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `${idOf(k)}-error` : opts.hint ? `${idOf(k)}-hint` : undefined}
      />
      {errors[k] ? (
        <span id={`${idOf(k)}-error`} className="text-xs font-normal text-destructive">
          {errors[k]}
        </span>
      ) : opts.hint ? (
        <span id={`${idOf(k)}-hint`} className="text-xs font-normal text-muted-foreground">
          {opts.hint}
        </span>
      ) : null}
    </div>
  );
  const capPct = ((maxArrangementBps ?? 0) / 100).toFixed(1);

  /** Client checks the server repeats; each problem is shown on its own field. */
  function validate(): Partial<Record<keyof Values, string>> {
    const e: Partial<Record<keyof Values, string>> = {};
    const premiumBps = toBps(v.premiumPct);
    if (!(premiumBps >= 500 && premiumBps <= 600)) e.premiumPct = "Premium must be between 5% and 6%";
    if (!(Number(v.maturityIn) > Number(v.closeIn))) e.maturityIn = "Maturity must come after the subscription close";
    const feeBps = toBps(v.arrangementPct);
    if (!(feeBps >= 0 && feeBps <= (maxArrangementBps ?? 0))) e.arrangementPct = `Arrangement fee must be between 0% and ${capPct}%`;
    return e;
  }

  async function submit() {
    const found = validate();
    setErrors(found);
    const first = (Object.keys(found) as (keyof Values)[])[0];
    if (first) {
      document.getElementById(idOf(first))?.focus();
      return { ok: false as const, error: { code: "BadRequest", title: "Fix the highlighted fields", detail: "", action: "none" as const }, logs: [] };
    }
    const premiumBps = toBps(v.premiumPct);
    return createPoolAction({
      poolId: v.poolId,
      crop: v.crop,
      season: Number(v.season),
      name: v.name,
      symbol: v.symbol,
      yieldBps: toBps(v.yieldPct),
      premiumBps,
      arrangementFeeBps: maxArrangementBps === null ? 0 : toBps(v.arrangementPct),
      closeInMinutes: Number(v.closeIn),
      maturityInMinutes: Number(v.maturityIn),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Instrument</legend>
        {field("poolId", "Pool ID", true)}
        {field("name", "Name")}
        {field("symbol", "Symbol")}
        {field("crop", "Crop")}
        {field("season", "Season", true)}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Terms</legend>
        {field("yieldPct", "Fixed yield (%)", true)}
        {field("premiumPct", "Premium (%)", true)}
        {field(
          "arrangementPct",
          "Arrangement fee (%)",
          true,
          maxArrangementBps === null
            ? { hint: "Fees are not configured on-chain yet.", disabled: true }
            : { hint: `Paid by the farmer, withheld at disbursement. At most ${capPct}%.` },
        )}
        {field("closeIn", "Subscription closes in (minutes)", true)}
        {field("maturityIn", "Matures in (minutes)", true)}
      </fieldset>
      <ActionButton label="Create pool" role="Issuer" action={submit} />
    </div>
  );
}

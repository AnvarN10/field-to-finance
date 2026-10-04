"use client";

import { useId, useState } from "react";
import { createPoolAction } from "../../app/admin/actions";
import { Input } from "../ui/input";
import { ActionButton } from "./action-button";

const toBps = (pct: string) => Math.round(Number(pct) * 100);

type Values = {
  issuer: string;
  nominalUsd: string;
  couponPct: string;
  mode: string;
  volumeT: string;
  sharePct: string;
  elevator: string;
  lab: string;
  interestDays: string;
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
const MODES = [
  ["Hybrid", "Hybrid: delivery with the issuer's buyback right"],
  ["CashBuyback", "Cash buyback"],
  ["GrainDelivery", "Grain delivery"],
] as const;
const WALLET = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * `maxArrangementBps`: FeeConfig cap, or null while fees are not configured (the fee is then fixed at 0).
 * `farmers`: KYC-approved producers offered as issuer of record for a term-sheet instrument (ADR 0014).
 */
export function CreatePoolForm({
  defaultPoolId,
  maxArrangementBps,
  farmers = [],
}: {
  defaultPoolId: string;
  maxArrangementBps: number | null;
  farmers?: { wallet: string; label: string }[];
}) {
  const [pilot, setPilot] = useState(false);
  const [v, setV] = useState<Values>({
    issuer: farmers[0]?.wallet ?? "",
    nominalUsd: "100000",
    couponPct: "5.0",
    mode: "Hybrid",
    volumeT: "10000",
    sharePct: "30",
    elevator: "Ust-Kamenogorsk",
    lab: "Baltic Control",
    interestDays: "",
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
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const field = (k: keyof Values, label: string, numeric = false, opts: { hint?: string; disabled?: boolean; list?: string } = {}) => (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <label htmlFor={idOf(k)}>{label}</label>
      <Input
        id={idOf(k)}
        value={v[k]}
        onChange={set(k)}
        disabled={opts.disabled}
        list={opts.list}
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
    if (pilot) {
      if (!WALLET.test(v.issuer.trim())) e.issuer = "Pick a KYC-approved farmer wallet";
      if (!(Number.isInteger(Number(v.nominalUsd)) && Number(v.nominalUsd) >= 1)) e.nominalUsd = "Nominal must be a whole number of dollars";
      if (!(toBps(v.couponPct) >= 0 && toBps(v.couponPct) <= 3_000)) e.couponPct = "Coupon must be between 0% and 30%";
      if (!(Number.isInteger(Number(v.volumeT)) && Number(v.volumeT) >= 1)) e.volumeT = "Volume must be whole tonnes";
      if (!(toBps(v.sharePct) >= 1 && toBps(v.sharePct) <= 3_000)) e.sharePct = "Tokenized share must be above 0% and at most 30%";
      if (!v.elevator.trim() || v.elevator.length > 32) e.elevator = "Up to 32 characters";
      if (!v.lab.trim() || v.lab.length > 32) e.lab = "Up to 32 characters";
      if (v.interestDays && !(Number.isInteger(Number(v.interestDays)) && Number(v.interestDays) >= 1)) e.interestDays = "Whole days, or leave empty";
    }
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
      ...(pilot
        ? {
            instrument: {
              issuerOfRecord: v.issuer.trim(),
              unitNominalUsd: Number(v.nominalUsd),
              couponBps: toBps(v.couponPct),
              settlementMode: v.mode,
              volumeTonnes: Number(v.volumeT),
              tokenizedShareBps: toBps(v.sharePct),
              elevator: v.elevator.trim(),
              lab: v.lab.trim(),
              ...(v.interestDays ? { interestDays: Number(v.interestDays) } : {}),
            },
          }
        : {}),
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
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={pilot}
          onChange={(e) => setPilot(e.target.checked)}
          className="size-4 rounded-sm border border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        Term sheet instrument: farmer as issuer, whole tokens, Act/360 coupon
      </label>
      {pilot ? (
        <fieldset className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <legend className="sr-only">Term sheet</legend>
          <div className="sm:col-span-3">
            {field("issuer", "Issuer of record (farmer wallet)", false, {
              list: `${base}-farmers`,
              hint: farmers.length ? "KYC-approved farmers with projects waiting for a pool. The program refuses a wallet without KYC." : "No KYC-approved farmer yet: approve the farmer's wallet in KYC first.",
            })}
            <datalist id={`${base}-farmers`}>
              {farmers.map((f) => (
                <option key={f.wallet} value={f.wallet}>
                  {f.label}
                </option>
              ))}
            </datalist>
          </div>
          {field("nominalUsd", "Nominal per token (USD)", true)}
          {field("couponPct", "Coupon (% a year, Act/360)", true)}
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <label htmlFor={idOf("mode")}>Settlement</label>
            <select
              id={idOf("mode")}
              value={v.mode}
              onChange={set("mode")}
              className="h-9 min-w-0 rounded-md border border-input bg-card px-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {MODES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {field("volumeT", "Contracted volume (t)", true)}
          {field("sharePct", "Tokenized share (%)", true, { hint: "At most 30% of the harvest." })}
          {field("interestDays", "Interest days (demo)", true, { hint: "Empty: interest runs from subscription close. Set to backdate the start for a minutes-long demo." })}
          {field("elevator", "Elevator")}
          {field("lab", "Laboratory")}
          <p className="text-xs text-muted-foreground sm:col-span-3">Quality spec: the term sheet&apos;s 12 parameters for HiPro class 3 wheat, stored in the bucket; its hash goes on-chain.</p>
        </fieldset>
      ) : null}
      <ActionButton label="Create pool" role="Issuer" action={submit} />
    </div>
  );
}

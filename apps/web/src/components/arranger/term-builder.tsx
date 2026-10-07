"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "../../app/console/_actions/pools";
import { structureAction } from "../../app/console/_actions/applications";
import { formatUsd } from "../../lib/format";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ActionResultView } from "./action-result";

export type TermDefaults = {
  name: string;
  symbol: string;
  unitNominalUsd: number;
  couponBps: number;
  settlementMode: "Hybrid" | "CashBuyback" | "GrainDelivery";
  closeInMinutes: number;
  maturityInMinutes: number;
  arrangementFeeBps: number;
};

const MODES = [
  ["Hybrid", "Hybrid: delivery with the issuer's buyback right"],
  ["CashBuyback", "Cash buyback"],
  ["GrainDelivery", "Grain delivery"],
] as const;
const field = "flex flex-col gap-1.5 text-sm font-medium";

/** Term builder: the pool and its InstrumentTerms from the application, the farmer's wallet as issuer of record. */
export function TermBuilder({ applicationId, requestedUsd, defaults, maxArrangementBps }: { applicationId: string; requestedUsd: number; defaults: TermDefaults; maxArrangementBps: number | null }) {
  const router = useRouter();
  const [v, setV] = useState({
    name: defaults.name,
    symbol: defaults.symbol,
    nominal: String(defaults.unitNominalUsd),
    coupon: String(defaults.couponBps / 100),
    mode: defaults.settlementMode as string,
    close: String(defaults.closeInMinutes),
    maturity: String(defaults.maturityInMinutes),
    fee: String(defaults.arrangementFeeBps / 100),
  });
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const nominal = Number(v.nominal);
  const divides = Number.isInteger(nominal) && nominal > 0 && requestedUsd % nominal === 0;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await structureAction(applicationId, {
            name: v.name.trim(),
            symbol: v.symbol.trim(),
            unitNominalUsd: nominal,
            couponBps: Math.round(Number(v.coupon) * 100),
            settlementMode: v.mode as TermDefaults["settlementMode"],
            closeInMinutes: Number(v.close),
            maturityInMinutes: Number(v.maturity),
            arrangementFeeBps: Math.round(Number(v.fee) * 100),
          });
          setResult(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <label className={field}>
          Instrument name
          <Input value={v.name} onChange={set("name")} maxLength={32} />
        </label>
        <label className={field}>
          Symbol
          <Input value={v.symbol} onChange={set("symbol")} maxLength={10} />
        </label>
        <label className={field}>
          Nominal per token (USD)
          <Input value={v.nominal} onChange={set("nominal")} inputMode="numeric" aria-invalid={divides ? undefined : true} />
        </label>
        <label className={field}>
          Coupon (% a year, Act/360)
          <Input value={v.coupon} onChange={set("coupon")} inputMode="decimal" />
        </label>
        <label className={field}>
          Settlement
          <select value={v.mode} onChange={set("mode")} className="h-9 rounded-md border border-input bg-card px-2.5 text-base md:text-sm">
            {MODES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          Subscription closes in (minutes)
          <Input value={v.close} onChange={set("close")} inputMode="numeric" />
        </label>
        <label className={field}>
          Maturity in (minutes)
          <Input value={v.maturity} onChange={set("maturity")} inputMode="numeric" />
        </label>
        <label className={field}>
          Arrangement fee (%)
          <Input value={v.fee} onChange={set("fee")} inputMode="decimal" disabled={maxArrangementBps === null} />
        </label>
      </div>
      <p className={`tabular text-sm ${divides ? "text-muted-foreground" : "text-destructive"}`}>
        {divides
          ? `${requestedUsd / nominal} tokens of ${formatUsd(BigInt(nominal) * 1_000_000n)}, ${formatUsd(BigInt(requestedUsd) * 1_000_000n)} in total. Volume, tokenized share, elevator and laboratory come from the application.`
          : `The nominal must divide ${formatUsd(BigInt(requestedUsd) * 1_000_000n)} into whole tokens.`}
      </p>
      <Button type="submit" disabled={pending || !divides} className="self-start">
        {pending ? "Creating the pool" : "Create the pool and add the project"}
      </Button>
      <ActionResultView result={result} />
    </form>
  );
}

"use client";

import { useState } from "react";
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
  closeIn: string;
  maturityIn: string;
};

export function CreatePoolForm({ defaultPoolId }: { defaultPoolId: string }) {
  const [v, setV] = useState<Values>({
    poolId: defaultPoolId,
    crop: "wheat",
    season: "2027",
    name: "Wheat 2027",
    symbol: "WHEAT-2027",
    yieldPct: "8.0",
    premiumPct: "5.5",
    closeIn: "10",
    maturityIn: "20",
  });
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const field = (k: keyof Values, label: string, numeric = false) => (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <Input value={v[k]} onChange={set(k)} inputMode={numeric ? "decimal" : undefined} className={numeric ? "tabular" : undefined} />
    </label>
  );

  async function submit() {
    const premiumBps = toBps(v.premiumPct);
    if (!(premiumBps >= 500 && premiumBps <= 600)) {
      // Shown by ActionButton like any other rejection; the server re-validates.
      return { ok: false as const, error: { code: "BadRequest", title: "Premium must be between 5% and 6%", detail: "", action: "none" as const }, logs: [] };
    }
    return createPoolAction({
      poolId: v.poolId,
      crop: v.crop,
      season: Number(v.season),
      name: v.name,
      symbol: v.symbol,
      yieldBps: toBps(v.yieldPct),
      premiumBps,
      closeInMinutes: Number(v.closeIn),
      maturityInMinutes: Number(v.maturityIn),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Instrument</legend>
        {field("poolId", "Pool id", true)}
        {field("name", "Name")}
        {field("symbol", "Symbol")}
        {field("crop", "Crop")}
        {field("season", "Season", true)}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Terms</legend>
        {field("yieldPct", "Fixed yield (%)", true)}
        {field("premiumPct", "Premium (%)", true)}
        <span className="hidden sm:block" aria-hidden />
        {field("closeIn", "Subscription closes in (minutes)", true)}
        {field("maturityIn", "Matures in (minutes)", true)}
      </fieldset>
      <ActionButton label="Create pool" role="Issuer" action={submit} />
    </div>
  );
}

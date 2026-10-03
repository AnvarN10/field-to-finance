import { formatUsd } from "../../lib/format";

export function FundingMeter({ raised, target }: { raised: string; target: string }) {
  const t = BigInt(target);
  const tenths = t === 0n ? 0n : (BigInt(raised) * 1000n) / t;
  const pct = Number(tenths) / 10;
  return (
    <div className="flex flex-col gap-2">
      <div
        role="meter"
        aria-label="Raised"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${formatUsd(raised)} of ${formatUsd(target)}`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        {/* scaleX, not width: the fill animates once on mount (globals.css .meter-fill) on the compositor. */}
        <div data-slot="meter-fill" className="meter-fill h-full w-full bg-primary" style={{ transform: `scaleX(${Math.min(pct, 100) / 100})` }} />
      </div>
      <div className="tabular flex justify-between text-sm">
        <span className="font-medium">{`${formatUsd(raised)} of ${formatUsd(target)}`}</span>
        <span className="text-muted-foreground">{pct.toFixed(1)}% funded</span>
      </div>
    </div>
  );
}

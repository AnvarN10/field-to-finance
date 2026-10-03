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
        {/* A transform, not width: the full-width fill is shifted left by the unfunded share and slides in once
            on mount (globals.css .meter-fill), on the compositor. The track's overflow-hidden clips it. */}
        <div
          data-slot="meter-fill"
          className="meter-fill h-full w-full rounded-full bg-primary"
          style={{ translate: `${Math.min(pct, 100) - 100}% 0` }}
        />
      </div>
      <div className="tabular flex justify-between text-sm">
        <span className="font-medium">{`${formatUsd(raised)} of ${formatUsd(target)}`}</span>
        <span className="text-muted-foreground">{pct.toFixed(1)}% funded</span>
      </div>
    </div>
  );
}

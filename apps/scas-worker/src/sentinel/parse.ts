import { z } from "zod";
import { SentinelError } from "../errors";

const StatsSchema = z.object({
  mean: z.union([z.number(), z.string()]).optional(),
  sampleCount: z.number(),
  noDataCount: z.number(),
});
const OutputSchema = z.object({ bands: z.object({ B0: z.object({ stats: StatsSchema }) }) });
const IntervalSchema = z.object({
  interval: z.object({ from: z.string(), to: z.string() }),
  outputs: z.object({ ndvi: OutputSchema, footprint: OutputSchema }).optional(),
  error: z.object({ type: z.string().optional(), message: z.string().optional() }).optional(),
});
const ResponseSchema = z.object({ data: z.array(IntervalSchema) });

export interface Observation {
  /** Acquisition day, YYYY-MM-DD (UTC). */
  date: string;
  /** Mean NDVI over clear polygon pixels; null when no pixel was clear. */
  ndviMean: number | null;
  /** Clear pixels divided by the polygon's pixel count; a scene is clear at 0.7 or more. */
  clearRatio: number;
  clearPixels: number;
  footprintPixels: number;
}

export interface FailedInterval {
  date: string;
  error: string;
}

export interface ParsedStats {
  observations: Observation[];
  failedIntervals: FailedInterval[];
  polygonPixels: number;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function parseStats(raw: unknown): ParsedStats {
  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SentinelError(`unexpected Statistical API response: ${parsed.error.issues[0]?.message ?? "invalid"}`, {
      retryable: false,
    });
  }

  const failedIntervals: FailedInterval[] = [];
  const days: { date: string; footprint: number; clear: number; mean: number | null }[] = [];

  for (const item of parsed.data.data) {
    const date = item.interval.from.slice(0, 10);
    if (item.error || !item.outputs) {
      failedIntervals.push({ date, error: item.error?.message ?? item.error?.type ?? "missing outputs" });
      continue;
    }
    const fp = item.outputs.footprint.bands.B0.stats;
    const nd = item.outputs.ndvi.bands.B0.stats;
    const footprint = fp.sampleCount - fp.noDataCount;
    if (footprint <= 0) continue; // no acquisition over the polygon that day
    const clear = nd.sampleCount - nd.noDataCount;
    const mean = nd.mean === undefined ? Number.NaN : Number(nd.mean);
    days.push({ date, footprint, clear, mean: clear > 0 && Number.isFinite(mean) ? mean : null });
  }

  if (parsed.data.data.length > 0 && failedIntervals.length === parsed.data.data.length) {
    throw new SentinelError(`all ${failedIntervals.length} intervals failed: ${failedIntervals[0]?.error}`, {
      retryable: false,
    });
  }

  const polygonPixels = days.reduce((max, d) => Math.max(max, d.footprint), 0);
  const observations = days.map((d) => ({
    date: d.date,
    ndviMean: d.mean,
    clearPixels: d.clear,
    footprintPixels: d.footprint,
    clearRatio: polygonPixels > 0 ? round4(d.clear / polygonPixels) : 0,
  }));
  return { observations, failedIntervals, polygonPixels };
}

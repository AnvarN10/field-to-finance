import type { AttestationKindName, VerdictName } from "@f2f/sdk";
import { RequestError } from "../errors";
import { areaMismatch, type GeometryCheck } from "../geometry";
import type { Observation } from "../sentinel/parse";
import { calendarFor, type CropCalendar } from "./crops";

export const RULES_VERSION = "f2f-scas-rules/1";
/** Spec: scenes with more than 30% cloud over the polygon are skipped. */
export const CLEAR_RATIO_MIN = 0.7;
export const AREA_TOLERANCE = 0.05;
export const WINDOW_DAYS: Record<AttestationKindName, number> = {
  FieldVerified: 90,
  Sowing: 30,
  Vegetation: 20,
  Harvest: 120,
};

export interface DecideInput {
  kind: AttestationKindName;
  crop: string;
  asOf: Date;
  geometry: GeometryCheck;
  declaredAreaHa: number;
  observations: Observation[];
}

export interface Decision {
  verdict: VerdictName;
  ndviMean: number | null;
  sceneDate: string | null;
  reasons: string[];
}

type ClearObservation = Observation & { ndviMean: number };

const isClear = (o: Observation): o is ClearObservation => o.ndviMean !== null && o.clearRatio >= CLEAR_RATIO_MIN;
const fmt = (n: number) => n.toFixed(3);
const month = (d: Date) => d.getUTCMonth() + 1;

function requireCalendar(crop: string): CropCalendar {
  const cal = calendarFor(crop);
  if (!cal) throw new RequestError(`no crop calendar for "${crop}"; season Attestations need one`, 422);
  return cal;
}

/** Throws before any API call when a season rule cannot apply to this crop and date. */
export function assertRuleApplicable(kind: AttestationKindName, crop: string, asOf: Date): void {
  if (kind === "FieldVerified") return;
  const cal = requireCalendar(crop);
  const m = month(asOf);
  const months =
    kind === "Sowing" ? cal.sowingMonths : kind === "Harvest" ? cal.harvestMonths : Object.keys(cal.vegetation).map(Number);
  if (!months.includes(m)) {
    throw new RequestError(`${kind} is not defined for ${crop} in month ${m}; allowed months: ${months.join(", ")}`, 422);
  }
}

export function decide(input: DecideInput): Decision {
  const clear = input.observations.filter(isClear).sort((a, b) => a.date.localeCompare(b.date));
  const latest = clear.at(-1);
  const base = { ndviMean: latest?.ndviMean ?? null, sceneDate: latest?.date ?? null };
  const insufficient = (reason: string): Decision => ({ verdict: "InsufficientData", ...base, reasons: [reason] });
  const noClear = `no observation with at least ${CLEAR_RATIO_MIN * 100}% clear pixels in the window`;

  if (!input.geometry.valid) return { verdict: "Fail", ...base, reasons: input.geometry.reasons };

  switch (input.kind) {
    case "FieldVerified": {
      const diff = areaMismatch(input.geometry.areaHa, input.declaredAreaHa);
      if (diff > AREA_TOLERANCE) {
        return {
          verdict: "Fail",
          ...base,
          reasons: [
            `computed area ${input.geometry.areaHa} ha differs from declared ${input.declaredAreaHa} ha by ${(diff * 100).toFixed(1)}% (limit ${AREA_TOLERANCE * 100}%)`,
          ],
        };
      }
      if (!latest) return insufficient(noClear);
      return {
        verdict: "Pass",
        ...base,
        reasons: [`area within ${(diff * 100).toFixed(1)}% of declared`, `latest clear scene ${latest.date}`],
      };
    }
    case "Sowing": {
      const [lo, hi] = requireCalendar(input.crop).sowingNdvi;
      if (!latest) return insufficient(noClear);
      const inBand = latest.ndviMean >= lo && latest.ndviMean <= hi;
      return {
        verdict: inBand ? "Pass" : "Fail",
        ...base,
        reasons: [`NDVI ${fmt(latest.ndviMean)} on ${latest.date} ${inBand ? "inside" : "outside"} sowing band [${lo}, ${hi}]`],
      };
    }
    case "Vegetation": {
      const range = requireCalendar(input.crop).vegetation[month(input.asOf)];
      if (!range) throw new RequestError(`no vegetation range for month ${month(input.asOf)}`, 422);
      if (!latest) return insufficient(noClear);
      const [lo, hi] = range;
      const inRange = latest.ndviMean >= lo && latest.ndviMean <= hi;
      return {
        verdict: inRange ? "Pass" : "Fail",
        ...base,
        reasons: [`NDVI ${fmt(latest.ndviMean)} on ${latest.date} ${inRange ? "inside" : "outside"} expected range [${lo}, ${hi}]`],
      };
    }
    case "Harvest": {
      const cal = requireCalendar(input.crop);
      if (!latest || clear.length < 2) return insufficient("need at least two clear scenes to see the drop after the peak");
      const peak = clear.reduce((best, o) => (o.ndviMean > best.ndviMean ? o : best));
      const dropped =
        peak.ndviMean >= cal.harvestPeakMin && latest.ndviMean <= cal.harvestLatestMax && latest.date > peak.date;
      return {
        verdict: dropped ? "Pass" : "Fail",
        ...base,
        reasons: [
          `peak NDVI ${fmt(peak.ndviMean)} on ${peak.date} (min ${cal.harvestPeakMin})`,
          `latest NDVI ${fmt(latest.ndviMean)} on ${latest.date} (max ${cal.harvestLatestMax})`,
        ],
      };
    }
  }
}

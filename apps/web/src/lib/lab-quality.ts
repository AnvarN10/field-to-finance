import type { QualitySpec } from "@f2f/sdk";

/** A quality requirement from the term sheet: a numeric bound or an expected text value. */
export type Rule = { op: "min" | "max" | "eq"; value: number; unit: string } | { op: "text"; expected: string };

const NUM = "(\\d+(?:[.,]\\d+)?)";

/**
 * Reads the pilot spec's requirement strings: "≥ 30%" (min), "≤ 2%" (max), "14% (12%)" (max: the bracket is the
 * target, the first figure the limit), anything without a number is an expected value ("None", "Wheat").
 */
export function parseRequirement(req: string): Rule {
  const s = req.trim();
  const bound = new RegExp(`^(≥|>=|≤|<=)\\s*${NUM}\\s*(.*)$`).exec(s);
  if (bound) return { op: bound[1] === "≥" || bound[1] === ">=" ? "min" : "max", value: Number((bound[2] as string).replace(",", ".")), unit: (bound[3] as string).trim() };
  const limit = new RegExp(`^${NUM}\\s*([^\\s(]*)\\s*\\(.*\\)$`).exec(s);
  if (limit) return { op: "max", value: Number((limit[1] as string).replace(",", ".")), unit: (limit[2] as string).trim() };
  const exact = new RegExp(`^${NUM}\\s*(.*)$`).exec(s);
  if (exact) return { op: "eq", value: Number((exact[1] as string).replace(",", ".")), unit: (exact[2] as string).trim() };
  return { op: "text", expected: s.toLowerCase() };
}

export interface LabResult {
  key: string;
  label: string;
  requirement: string;
  measured: string | null;
  /** null: missing or unreadable measurement. */
  pass: boolean | null;
}

export type LabVerdict = "Pass" | "Fail" | "InsufficientData";

const number = (v: string): number | null => {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*\S*\s*$/.exec(v);
  return m ? Number((m[1] as string).replace(",", ".")) : null;
};

/** Evaluates a lab protocol against the spec: pass/fail per parameter; any fail → Fail, else any missing → InsufficientData. */
export function evaluateLab(spec: QualitySpec, measured: Record<string, string>): { results: LabResult[]; verdict: LabVerdict } {
  const results = spec.parameters.map((p): LabResult => {
    const raw = measured[p.key]?.trim() ?? "";
    if (!raw) return { key: p.key, label: p.label, requirement: p.requirement, measured: null, pass: null };
    const rule = parseRequirement(p.requirement);
    if (rule.op === "text") return { key: p.key, label: p.label, requirement: p.requirement, measured: raw, pass: raw.toLowerCase() === rule.expected };
    const n = number(raw);
    if (n === null) return { key: p.key, label: p.label, requirement: p.requirement, measured: raw, pass: null };
    const pass = rule.op === "min" ? n >= rule.value : rule.op === "max" ? n <= rule.value : n === rule.value;
    return { key: p.key, label: p.label, requirement: p.requirement, measured: raw, pass };
  });
  const verdict: LabVerdict = results.some((r) => r.pass === false) ? "Fail" : results.some((r) => r.pass === null) ? "InsufficientData" : "Pass";
  return { results, verdict };
}

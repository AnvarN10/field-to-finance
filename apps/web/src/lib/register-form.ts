import { parseUsd } from "./format";

export interface RegistrationErrors {
  upload?: string;
  declared?: (string | undefined)[];
  tonnes?: string;
  usd?: string;
}

export interface RegistrationValues {
  expectedKg: string;
  requestedAmount: string;
  areaHaX100: number[];
}

/** Farmer "Register fields" checks, one message per control so each input can carry its own error. */
export function validateRegistration(input: { fieldCount: number; tonnes: string; usd: string; declaredHa: string[] }): {
  errors: RegistrationErrors;
  values: RegistrationValues | null;
} {
  const errors: RegistrationErrors = {};
  if (input.fieldCount === 0) errors.upload = "Upload your field boundaries first.";
  const areaHaX100 = input.declaredHa.map((d) => Math.round(Number(d) * 100));
  const declared = areaHaX100.map((a, i) => (input.declaredHa[i]?.trim() && Number.isFinite(a) && a > 0 ? undefined : "Enter an area above 0 ha."));
  if (declared.some(Boolean)) errors.declared = declared;
  const t = Number(input.tonnes);
  if (!input.tonnes.trim() || !Number.isFinite(t) || t <= 0) errors.tonnes = "Enter the expected harvest in tonnes.";
  let requested: bigint | null = null;
  try {
    requested = parseUsd(input.usd);
  } catch (e) {
    errors.usd = (e as Error).message;
  }
  if (Object.keys(errors).length || requested === null) return { errors, values: null };
  return { errors, values: { expectedKg: String(Math.round(t * 1000)), requestedAmount: requested.toString(), areaHaX100 } };
}

/** The control to focus after a failed submit, in form order: upload, declared areas, tonnes, amount. */
export function firstInvalid(errors: RegistrationErrors): string | null {
  if (errors.upload) return "upload";
  const i = errors.declared?.findIndex(Boolean) ?? -1;
  if (i >= 0) return `declared-${i}`;
  if (errors.tonnes) return "tonnes";
  if (errors.usd) return "usd";
  return null;
}

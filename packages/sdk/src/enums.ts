export const ATTESTATION_KINDS = ["FieldVerified", "Sowing", "Vegetation", "Harvest"] as const;
export type AttestationKindName = (typeof ATTESTATION_KINDS)[number];

export const VERDICTS = ["Pass", "Fail", "InsufficientData"] as const;
export type VerdictName = (typeof VERDICTS)[number];

/** Anchor's TS encoding of a unit enum variant, e.g. `{ fieldVerified: {} }`. */
export type AnchorEnum = Record<string, Record<string, never>>;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function toAnchorEnum(name: string): AnchorEnum {
  return { [lowerFirst(name)]: {} };
}

function fromAnchorEnum<T extends string>(value: unknown, names: readonly T[]): T {
  if (!value || typeof value !== "object") throw new TypeError("not an Anchor enum value");
  const key = Object.keys(value)[0];
  const match = names.find((n) => lowerFirst(n) === key);
  if (!match) throw new TypeError(`unknown enum variant: ${String(key)}`);
  return match;
}

export const kindFromAnchor = (value: unknown): AttestationKindName => fromAnchorEnum(value, ATTESTATION_KINDS);
export const verdictFromAnchor = (value: unknown): VerdictName => fromAnchorEnum(value, VERDICTS);

/** Accepts `FieldVerified`, `field-verified`, `field_verified`, `fieldverified` in any case. */
export function parseKind(input: string): AttestationKindName {
  const norm = input.replace(/[-_\s]/g, "").toLowerCase();
  const match = ATTESTATION_KINDS.find((k) => k.toLowerCase() === norm);
  if (!match) throw new RangeError(`unknown attestation kind "${input}"; expected one of ${ATTESTATION_KINDS.join(", ")}`);
  return match;
}

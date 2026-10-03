import { Keypair } from "@solana/web3.js";

export class MissingSecretError extends Error {
  override name = "MissingSecretError";
}

/** Parses a solana-keygen JSON byte array. Errors name the variable and never include its value. */
export function parseKeypair(name: string, raw: string | undefined): Keypair {
  if (!raw || raw.trim() === "") throw new MissingSecretError(`${name} is not set`);
  let bytes: unknown;
  try {
    bytes = JSON.parse(raw);
  } catch {
    throw new Error(`${name} is not valid JSON; expected the 64-byte array from solana-keygen`);
  }
  if (
    !Array.isArray(bytes) ||
    bytes.length !== 64 ||
    !bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
  ) {
    throw new Error(`${name} must be a JSON array of 64 bytes`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes as number[]));
}

export const ROLE_KEY_VARS = ["F2F_DEPLOYER_KEYPAIR", "F2F_ISSUER_KEYPAIR", "F2F_COMPLIANCE_KEYPAIR", "SCAS_SECRET_KEY"] as const;

/** Boot check: every role key that is set must parse. Unset keys are allowed (their features say so). */
export function assertRoleKeys(source: Record<string, string | undefined>): void {
  for (const name of ROLE_KEY_VARS) {
    const raw = source[name];
    if (raw !== undefined && raw.trim() !== "") parseKeypair(name, raw);
  }
}

/** The admin console's message for a role key: null when it parses, else what is wrong (missing or malformed). */
export function roleKeyProblem(name: string, raw: string | undefined): string | null {
  try {
    parseKeypair(name, raw);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

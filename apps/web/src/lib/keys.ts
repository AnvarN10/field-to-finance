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

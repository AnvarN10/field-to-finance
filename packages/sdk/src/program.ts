import { PublicKey } from "@solana/web3.js";
import idl from "./idl/f2f.json" with { type: "json" };
import type { F2f } from "./idl/f2f";

export type { F2f };

/**
 * The raw IDL as emitted by `anchor build` (snake_case names). `Program` from
 * @anchor-lang/core accepts it and exposes camelCase names typed by `F2f`.
 */
export const F2F_IDL = idl as unknown as F2f;

export const F2F_PROGRAM_ID = new PublicKey(F2F_IDL.address);

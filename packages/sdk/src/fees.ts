/** Mirror MAX_ARRANGEMENT_BPS, MAX_NETWORK_FEE and MAX_MINT_FEE in anchor/programs/f2f/src/constants.rs. */
export const MAX_ARRANGEMENT_BPS = 1_000;
export const MAX_NETWORK_FEE = 10_000_000;
export const MAX_MINT_FEE = 50_000_000;
export const BPS = 10_000n;

/** Arrangement fee withheld at disbursement: `fee = requested * bps / 10_000` rounded down, `net = requested - fee`. */
export function splitArrangementFee(requested: bigint, bps: number): { fee: bigint; net: bigint } {
  if (!Number.isInteger(bps) || bps < 0 || bps > Number(BPS)) throw new RangeError(`bps out of range: ${bps}`);
  const fee = (requested * BigInt(bps)) / BPS;
  return { fee, net: requested - fee };
}

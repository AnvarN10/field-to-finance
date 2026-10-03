import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { MAX_ARRANGEMENT_BPS, MAX_MINT_FEE, MAX_NETWORK_FEE, splitArrangementFee } from "../src/fees";
import { F2F_IDL } from "../src/program";
import { feesPda, termsPda } from "../src/pda";

const PROGRAM = new PublicKey("9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm");
const find = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM)[0];

describe("fee PDAs", () => {
  it("fee config is the singleton [\"fees\"]", () => {
    expect(feesPda(PROGRAM).equals(find([Buffer.from("fees")]))).toBe(true);
  });
  it("pool terms are [\"terms\", pool]", () => {
    const pool = Keypair.generate().publicKey;
    expect(termsPda(PROGRAM, pool).equals(find([Buffer.from("terms"), pool.toBuffer()]))).toBe(true);
  });
});

describe("splitArrangementFee mirrors math::split_fee", () => {
  it("withholds bps of the requested amount, rounding down", () => {
    expect(splitArrangementFee(100_000_000_000n, 200)).toEqual({ fee: 2_000_000_000n, net: 98_000_000_000n });
    expect(splitArrangementFee(101n, 200)).toEqual({ fee: 2n, net: 99n });
    expect(splitArrangementFee(49n, 200)).toEqual({ fee: 0n, net: 49n });
  });
  it("is zero for pools without terms", () => {
    expect(splitArrangementFee(5_000n, 0)).toEqual({ fee: 0n, net: 5_000n });
  });
  it("rejects bps outside 0..10000", () => {
    expect(() => splitArrangementFee(1n, 10_001)).toThrow(RangeError);
    expect(() => splitArrangementFee(1n, -1)).toThrow(RangeError);
  });
});

describe("fee caps mirror the program constants", () => {
  const constants = (F2F_IDL as unknown as { constants: { name: string; value: string }[] }).constants;
  const value = (name: string) => constants.find((c) => c.name === name)?.value.replace(/_/g, "");
  it.each([
    ["MAX_ARRANGEMENT_BPS", MAX_ARRANGEMENT_BPS],
    ["MAX_NETWORK_FEE", MAX_NETWORK_FEE],
    ["MAX_MINT_FEE", MAX_MINT_FEE],
  ])("%s", (name, v) => {
    expect(value(name)).toBe(String(v));
  });
});

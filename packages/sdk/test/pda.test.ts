import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { attestationPda, configPda, fieldPda, investorPda, mintPda, poolPda, projectPda } from "../src/pda";

const PROGRAM = new PublicKey("9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm");
const find = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM)[0];

describe("PDA helpers mirror the program seeds", () => {
  const key = Keypair.generate().publicKey;

  it("config", () => {
    expect(configPda(PROGRAM).equals(find([Buffer.from("config")]))).toBe(true);
  });

  it("project uses a u64 little-endian id", () => {
    const id = Buffer.from([7, 1, 0, 0, 0, 0, 0, 0]);
    expect(projectPda(PROGRAM, key, 263n).equals(find([Buffer.from("project"), key.toBuffer(), id]))).toBe(true);
  });

  it("field uses a single index byte", () => {
    expect(fieldPda(PROGRAM, key, 1).equals(find([Buffer.from("field"), key.toBuffer(), Buffer.from([1])]))).toBe(true);
  });

  it("attestation uses a u32 little-endian sequence", () => {
    const seq = Buffer.from([2, 1, 0, 0]);
    expect(attestationPda(PROGRAM, key, 258).equals(find([Buffer.from("attestation"), key.toBuffer(), seq]))).toBe(true);
  });

  it("pool, mint and investor", () => {
    const poolId = Buffer.from([5, 0, 0, 0, 0, 0, 0, 0]);
    const pool = poolPda(PROGRAM, 5);
    expect(pool.equals(find([Buffer.from("pool"), poolId]))).toBe(true);
    expect(mintPda(PROGRAM, pool).equals(find([Buffer.from("mint"), pool.toBuffer()]))).toBe(true);
    expect(investorPda(PROGRAM, key).equals(find([Buffer.from("investor"), key.toBuffer()]))).toBe(true);
  });

  it("rejects out-of-range integers", () => {
    expect(() => fieldPda(PROGRAM, key, 256)).toThrow(RangeError);
    expect(() => attestationPda(PROGRAM, key, -1)).toThrow(RangeError);
    expect(() => projectPda(PROGRAM, key, -1n)).toThrow(RangeError);
  });
});

import { F2F_IDL, attestationPda, configPda } from "@f2f/sdk";
import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildRecordAttestationIx, checkScasAuthority, createProgram, createSerialQueue } from "../src/chain";

describe("buildRecordAttestationIx", () => {
  // No RPC call happens: every account is passed explicitly.
  const scas = Keypair.generate();
  const programId = Keypair.generate().publicKey; // proves the IDL address is overridden
  const program = createProgram(new Connection("http://127.0.0.1:1"), scas, programId);
  const project = Keypair.generate().publicKey;
  const field = Keypair.generate().publicKey;
  const args = {
    project,
    field,
    sequence: 3,
    kind: "FieldVerified" as const,
    verdict: "Pass" as const,
    evidenceHash: new Uint8Array(32).fill(7),
    evidenceUri: "https://scas.example.app/e/ab",
    ndviMeanX10k: 1900,
    sceneDate: 1789862400,
  };

  it("orders accounts as the program expects and derives the attestation PDA from the sequence", async () => {
    const ix = await buildRecordAttestationIx(program, scas.publicKey, args);
    expect(ix.programId.equals(programId)).toBe(true);
    const keys = ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);
    expect(keys).toEqual([
      [scas.publicKey.toBase58(), true, true],
      [configPda(programId).toBase58(), false, false],
      [project.toBase58(), false, true],
      [field.toBase58(), false, true],
      [attestationPda(programId, field, 3).toBase58(), false, true],
      [SystemProgram.programId.toBase58(), false, false],
    ]);
  });

  it("encodes the arguments", async () => {
    const ix = await buildRecordAttestationIx(program, scas.publicKey, args);
    const idlIx = (F2F_IDL as unknown as { instructions: { name: string; discriminator: number[] }[] }).instructions.find(
      (i) => i.name === "record_attestation",
    );
    expect(Array.from(ix.data.subarray(0, 8))).toEqual(idlIx?.discriminator);
    const decoded = (program.coder.instruction as unknown as { decode(data: Buffer): unknown }).decode(ix.data) as {
      name: string;
      data: { kind: object; verdict: object; ndviMeanX10k: number; evidenceUri: string; sceneDate: { toNumber(): number } };
    };
    expect(decoded.name).toBe("recordAttestation");
    expect(decoded.data.kind).toEqual({ fieldVerified: {} });
    expect(decoded.data.verdict).toEqual({ pass: {} });
    expect(decoded.data.ndviMeanX10k).toBe(1900);
    expect(decoded.data.evidenceUri).toBe(args.evidenceUri);
    expect(decoded.data.sceneDate.toNumber()).toBe(1789862400);
  });
});

describe("checkScasAuthority", () => {
  it("names both keys when the signer is not the Config SCAS authority", () => {
    const a = Keypair.generate().publicKey;
    const b = Keypair.generate().publicKey;
    expect(() => checkScasAuthority(a, a)).not.toThrow();
    expect(() => checkScasAuthority(a, b)).toThrow(new RegExp(`${b.toBase58()}.*${a.toBase58()}`));
  });
});

describe("createSerialQueue", () => {
  it("runs tasks one at a time in submission order, even after a failure", async () => {
    const run = createSerialQueue();
    const events: string[] = [];
    const slow = run(async () => {
      events.push("a:start");
      await new Promise((r) => setTimeout(r, 20));
      events.push("a:end");
      throw new Error("a failed");
    });
    const fast = run(async () => {
      events.push("b:start");
      return "b";
    });
    await expect(slow).rejects.toThrow("a failed");
    await expect(fast).resolves.toBe("b");
    expect(events).toEqual(["a:start", "a:end", "b:start"]);
  });
});

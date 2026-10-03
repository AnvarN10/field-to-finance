import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { attestationsOfField, fieldsOfProject, projectsByProducer, projectsInPool, projectsWithoutPool } from "../src/lib/chain/filters";
import { attestationValue, fieldValue, offlineProgram, projectValue, roundTrip } from "./fixtures/accounts";

const program = offlineProgram();

function matches(data: Buffer, filter: { memcmp: { offset: number; bytes: string } }): boolean {
  const want = Buffer.from(bs58.decode(filter.memcmp.bytes));
  return data.subarray(filter.memcmp.offset, filter.memcmp.offset + want.length).equals(want);
}

describe("memcmp filters match real account bytes", () => {
  it("finds projects by producer and by pool membership", async () => {
    const producer = Keypair.generate().publicKey;
    const pool = Keypair.generate().publicKey;
    const inPool = await roundTrip(program, "farmProject", projectValue({ producer, pool }));
    const free = await roundTrip(program, "farmProject", projectValue({ producer }));
    const f = (x: unknown) => x as { memcmp: { offset: number; bytes: string } };
    expect(matches(inPool.data, f(projectsByProducer(producer)))).toBe(true);
    expect(matches(inPool.data, f(projectsInPool(pool)))).toBe(true);
    expect(matches(free.data, f(projectsInPool(pool)))).toBe(false);
    expect(matches(free.data, f(projectsWithoutPool()))).toBe(true);
    expect(matches(inPool.data, f(projectsWithoutPool()))).toBe(false);
  });

  it("finds fields by project and attestations by field", async () => {
    const project = Keypair.generate().publicKey;
    const field = Keypair.generate().publicKey;
    const fd = await roundTrip(program, "field", fieldValue({ project }));
    const at = await roundTrip(program, "attestation", attestationValue({ field }));
    expect(matches(fd.data, fieldsOfProject(project) as never)).toBe(true);
    expect(matches(at.data, attestationsOfField(field) as never)).toBe(true);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { F2F_IDL, F2F_PROGRAM_ID } from "../src/program";

const BUILT_IDL = fileURLToPath(new URL("../../../anchor/target/idl/f2f.json", import.meta.url));

describe("committed IDL", () => {
  it("exposes the program id", () => {
    expect(F2F_PROGRAM_ID.toBase58()).toBe(F2F_IDL.address);
  });

  it("has record_attestation with the arguments the worker sends", () => {
    const ix = (F2F_IDL as unknown as { instructions: { name: string; args: { name: string }[] }[] }).instructions.find(
      (i) => i.name === "record_attestation",
    );
    expect(ix?.args.map((a) => a.name)).toEqual([
      "kind",
      "verdict",
      "evidence_hash",
      "evidence_uri",
      "ndvi_mean_x10k",
      "scene_date",
    ]);
  });

  it.skipIf(!existsSync(BUILT_IDL))("matches anchor/target (run `pnpm -C packages/sdk sync-idl` after anchor build)", () => {
    const built = JSON.parse(readFileSync(BUILT_IDL, "utf8")) as unknown;
    expect(F2F_IDL).toEqual(built);
  });
});

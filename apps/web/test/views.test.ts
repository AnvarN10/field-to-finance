import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import BN from "bn.js";
import type { AttestationAccount, FieldAccount, PoolAccount, ProjectAccount } from "../src/lib/chain/views";
import { toAttestationView, toFieldView, toPoolView, toProjectView } from "../src/lib/chain/views";
import { attestationValue, fieldValue, offlineProgram, poolValue, projectValue, roundTrip } from "./fixtures/accounts";

const program = offlineProgram();
const addr = Keypair.generate().publicKey;

describe("account views", () => {
  it("maps a Pool to strings and numbers", async () => {
    const { account } = await roundTrip<PoolAccount>(program, "pool", poolValue());
    const v = toPoolView(addr, account, null);
    expect(v).toMatchObject({
      address: addr.toBase58(),
      poolId: "7",
      crop: "wheat",
      season: 2027,
      targetAmount: "2000000000",
      raisedAmount: "500000000",
      yieldBps: 800,
      premiumBps: 550,
      subscriptionCloseTs: 1_791_000_000,
      maturityTs: 1_791_000_600,
      status: "Open",
      instrument: null,
    });
  });

  it("maps a FarmProject with and without a pool and settlement", async () => {
    const pool = Keypair.generate().publicKey;
    const a = await roundTrip<ProjectAccount>(program, "farmProject", projectValue());
    expect(toProjectView(addr, a.account)).toMatchObject({ pool: null, settlement: null, expectedKg: "400000", tokenizedKg: "120000" });
    const b = await roundTrip<ProjectAccount>(
      program,
      "farmProject",
      projectValue({ pool, settlement: { cashRepaidWithPremium: {} }, disbursed: true }),
    );
    expect(toProjectView(addr, b.account)).toMatchObject({ pool: pool.toBase58(), settlement: "CashRepaidWithPremium", disbursed: true });
  });

  it("maps a Field polygon hash to hex", async () => {
    const { account } = await roundTrip<FieldAccount>(program, "field", fieldValue());
    const v = toFieldView(addr, account);
    expect(v.polygonHash).toBe("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    expect(v).toMatchObject({ index: 0, areaHaX100: 7611, verified: true, attestationCount: 1 });
  });

  it("maps an Attestation", async () => {
    const { account } = await roundTrip<AttestationAccount>(
      program,
      "attestation",
      attestationValue({ kind: { harvest: {} }, verdict: { pass: {} }, sequence: 3, recordedAt: new BN(1_791_000_222) }),
    );
    const v = toAttestationView(addr, account);
    expect(v).toMatchObject({ kind: "Harvest", verdict: "Pass", sequence: 3, recordedAt: 1_791_000_222, evidenceHash: "ab".repeat(32) });
  });
});

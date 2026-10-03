import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { MissingSecretError, parseKeypair } from "../src/lib/keys";

describe("parseKeypair", () => {
  it("parses a solana-keygen JSON byte array", () => {
    const kp = Keypair.generate();
    const parsed = parseKeypair("F2F_ISSUER_KEYPAIR", JSON.stringify(Array.from(kp.secretKey)));
    expect(parsed.publicKey.equals(kp.publicKey)).toBe(true);
  });

  it("names a missing variable", () => {
    expect(() => parseKeypair("SCAS_SECRET_KEY", undefined)).toThrow(MissingSecretError);
    expect(() => parseKeypair("SCAS_SECRET_KEY", "")).toThrow(/SCAS_SECRET_KEY is not set/);
  });

  it("never echoes a malformed value", () => {
    const secretish = "[1,2,3,SECRET-MATERIAL";
    for (const raw of [secretish, "[1,2,3]", '{"a":1}', JSON.stringify(new Array(64).fill(300))]) {
      let message = "";
      try {
        parseKeypair("F2F_COMPLIANCE_KEYPAIR", raw);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/F2F_COMPLIANCE_KEYPAIR/);
      expect(message).not.toContain("SECRET-MATERIAL");
      expect(message).not.toContain("300");
    }
  });
});

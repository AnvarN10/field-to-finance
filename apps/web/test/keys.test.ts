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

describe("assertRoleKeys", () => {
  it("fails at boot for a set but malformed role key, naming the variable only", async () => {
    const { assertRoleKeys } = await import("../src/lib/keys");
    const good = JSON.stringify(Array.from(Keypair.generate().secretKey));
    expect(() => assertRoleKeys({ F2F_ISSUER_KEYPAIR: good })).not.toThrow();
    expect(() => assertRoleKeys({})).not.toThrow();
    expect(() => assertRoleKeys({ F2F_SPONSOR_KEYPAIR: "[1]" })).toThrow("F2F_SPONSOR_KEYPAIR must be a JSON array of 64 bytes");
    expect(() => assertRoleKeys({ F2F_ISSUER_KEYPAIR: good, SCAS_SECRET_KEY: "[1,2,3]" })).toThrow("SCAS_SECRET_KEY must be a JSON array of 64 bytes");
    try {
      assertRoleKeys({ F2F_COMPLIANCE_KEYPAIR: "secret-value-here" });
    } catch (e) {
      expect((e as Error).message).not.toContain("secret-value-here");
    }
  });
});

describe("roleKeyProblem", () => {
  it("tells missing from malformed", async () => {
    const { roleKeyProblem } = await import("../src/lib/keys");
    expect(roleKeyProblem("F2F_ISSUER_KEYPAIR", undefined)).toBe("F2F_ISSUER_KEYPAIR is not set");
    expect(roleKeyProblem("F2F_ISSUER_KEYPAIR", "nope")).toBe("F2F_ISSUER_KEYPAIR is not valid JSON; expected the 64-byte array from solana-keygen");
    expect(roleKeyProblem("F2F_ISSUER_KEYPAIR", JSON.stringify(Array.from(Keypair.generate().secretKey)))).toBeNull();
  });
});

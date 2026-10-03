import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { kycFormSchema } from "../src/lib/kyc";

const valid = {
  wallet: Keypair.generate().publicKey.toBase58(),
  fullName: "Aigerim Sadykova",
  country: "Kazakhstan",
  email: "aigerim@example.com",
  eligible: true,
  demoConsent: true,
};

describe("kycFormSchema", () => {
  it("accepts a complete form", () => {
    expect(kycFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires both confirmations and a real email", () => {
    for (const bad of [{ eligible: false }, { demoConsent: false }, { email: "nope" }, { fullName: "A" }, { country: "Atlantis" }]) {
      expect(kycFormSchema.safeParse({ ...valid, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

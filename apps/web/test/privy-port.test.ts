import { describe, expect, it } from "vitest";
import { createPrivyPort } from "../src/lib/auth/privy-port";

describe("createPrivyPort", () => {
  it("accepts dev:<email> tokens only outside production with F2F_DEV_AUTH", async () => {
    const port = createPrivyPort({ appId: undefined, appSecret: undefined, devAuth: true, nodeEnv: "development" });
    expect(await port.verify("dev:Demo+Arranger@example.com")).toMatchObject({ did: "did:dev:demo+arranger@example.com" });
    expect(await port.profile("did:dev:demo+arranger@example.com")).toEqual({ email: "demo+arranger@example.com", solanaWallets: [] });
    await expect(port.verify("dev:not-an-email")).rejects.toThrow();
  });

  it("never accepts dev tokens in production, even with the flag set", async () => {
    const port = createPrivyPort({ appId: undefined, appSecret: undefined, devAuth: true, nodeEnv: "production" });
    await expect(port.verify("dev:ops@example.com")).rejects.toThrow(/Privy is not configured/);
  });

  it("names the missing variables when Privy is not configured", async () => {
    const port = createPrivyPort({ appId: "app", appSecret: undefined, devAuth: false, nodeEnv: "development" });
    await expect(port.verify("x")).rejects.toThrow(/PRIVY_APP_SECRET/);
  });
});

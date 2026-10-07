// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("@solana/wallet-adapter-react", () => ({ useWallet: () => ({ connected: false }) }));
const { WALLET_LABELS } = await import("../src/components/wallet/connect-button");

describe("wallet button labels", () => {
  it("says Connect wallet in sentence case instead of the adapter's Select Wallet", () => {
    expect(WALLET_LABELS["no-wallet"]).toBe("Connect wallet");
    expect(WALLET_LABELS["has-wallet"]).toBe("Connect wallet");
    for (const label of Object.values(WALLET_LABELS)) expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
  });
});

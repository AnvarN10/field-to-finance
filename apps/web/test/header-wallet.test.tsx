// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let pathname = "/pools";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const { HeaderWalletButton, WALLET_LABELS } = await import("../src/components/wallet/connect-button");

describe("HeaderWalletButton", () => {
  it("shows the investor wallet button on investor pages", () => {
    pathname = "/pools/1";
    const { container } = render(<HeaderWalletButton />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it("hides it on the farmer page, where sign-in is by email", () => {
    pathname = "/farmer";
    const { container } = render(<HeaderWalletButton />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("wallet button labels", () => {
  it("says Connect wallet in sentence case instead of the adapter's Select Wallet", () => {
    expect(WALLET_LABELS["no-wallet"]).toBe("Connect wallet");
    expect(WALLET_LABELS["has-wallet"]).toBe("Connect wallet");
    for (const label of Object.values(WALLET_LABELS)) expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
  });
});

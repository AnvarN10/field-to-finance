// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let pathname = "/pools";
let connected = false;
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@solana/wallet-adapter-react", () => ({ useWallet: () => ({ connected }) }));
const { HeaderWalletButton, WALLET_LABELS, pageHasConnect } = await import("../src/components/wallet/connect-button");

describe("HeaderWalletButton", () => {
  it("shows the investor wallet button on investor pages", () => {
    pathname = "/pools/1";
    const { container } = render(<HeaderWalletButton />);
    expect(container).not.toBeEmptyDOMElement();
  });

  it.each(["/farmer", "/farmer/applications/1", "/arranger", "/investor", "/investor/onboarding", "/sign-in", "/compliance", "/scas/pools/9", "/elevator", "/regulator/events"])("hides it on %s, where sign-in is by email", (p) => {
    pathname = p;
    const { container } = render(<HeaderWalletButton />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("one Connect wallet button at phone width", () => {
  it("hides the header button below 640px on pages that show their own connect call to action", () => {
    connected = false;
    pathname = "/pools/1";
    const { container } = render(<HeaderWalletButton />);
    expect(container.firstElementChild).toHaveClass("max-sm:hidden");
  });

  it("keeps it on pages without one, and everywhere once a wallet is connected", () => {
    connected = false;
    pathname = "/pools";
    const a = render(<HeaderWalletButton />);
    expect(a.container.firstElementChild).not.toHaveClass("max-sm:hidden");
    a.unmount();
    connected = true;
    pathname = "/pools/7";
    const b = render(<HeaderWalletButton />);
    expect(b.container.firstElementChild).not.toHaveClass("max-sm:hidden");
    connected = false;
  });

  it("knows which pages carry a connect button", () => {
    expect(pageHasConnect("/pools/7")).toBe(true);
    expect(pageHasConnect("/investor/onboarding")).toBe(true);
    expect(pageHasConnect("/portfolio")).toBe(false);
    expect(pageHasConnect("/pools")).toBe(false);
    expect(pageHasConnect("/fields/abc")).toBe(false);
  });
});

describe("wallet button labels", () => {
  it("says Connect wallet in sentence case instead of the adapter's Select Wallet", () => {
    expect(WALLET_LABELS["no-wallet"]).toBe("Connect wallet");
    expect(WALLET_LABELS["has-wallet"]).toBe("Connect wallet");
    for (const label of Object.values(WALLET_LABELS)) expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
  });
});

// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let pathname = "/pools";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const { HeaderWalletButton } = await import("../src/components/wallet/connect-button");

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

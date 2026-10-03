// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MintFeeNotice, mintFeeShortfall } from "../src/components/farmer/mint-fee-notice";

describe("mintFeeShortfall", () => {
  it("is zero when the wallet covers the fee or fees are off", () => {
    expect(mintFeeShortfall(3_000_000n, "3000000")).toBe(0n);
    expect(mintFeeShortfall(0n, null)).toBe(0n);
  });
  it("is the missing USDC otherwise", () => {
    expect(mintFeeShortfall(1_000_000n, "3000000")).toBe(2_000_000n);
  });
});

describe("MintFeeNotice", () => {
  it("discloses the 3 USDC mint fee and that no SOL is needed", () => {
    render(<MintFeeNotice wallet="W" mintFee="3000000" usdcBalance={10_000_000n} maxArrangementBps={1_000} />);
    expect(screen.getByText("Registration fee")).toBeInTheDocument();
    expect(screen.getByText("Registration fee").nextSibling).toHaveTextContent("$3.00");
    expect(screen.getByText("Your test USDC").nextSibling).toHaveTextContent("$10.00");
    expect(screen.getByText(/no SOL/i)).toBeInTheDocument();
    expect(screen.getByText(/arrangement fee of at most 10.0%/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /test USDC/ })).not.toBeInTheDocument();
  });

  it("offers test USDC when the wallet cannot pay the fee", () => {
    render(<MintFeeNotice wallet="W" mintFee="3000000" usdcBalance={0n} maxArrangementBps={1_000} />);
    expect(screen.getByText("You need $3.00 in test USDC to register.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get 1,000 test USDC" })).toBeInTheDocument();
  });

  it("says there is no fee when fees are not configured", () => {
    render(<MintFeeNotice wallet="W" mintFee={null} usdcBalance={0n} maxArrangementBps={null} />);
    expect(screen.getByText("Registration fee").nextSibling).toHaveTextContent("$0.00");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PoolSummaryCard } from "../src/components/pool/pool-summary-card";

describe("PoolSummaryCard", () => {
  it("shows symbol, fixed yield with term, raised of target and a link to the pool", () => {
    render(
      <PoolSummaryCard
        pool={{
          address: "A", poolId: "7", issuer: "I", mint: "M", vault: "V", crop: "wheat", season: 2027,
          targetAmount: "2000000000", raisedAmount: "500000000", yieldBps: 800, premiumBps: 550,
          subscriptionCloseTs: 1_791_000_600, maturityTs: 1_791_001_200, projectCount: 1, disbursedCount: 0, settledCount: 0,
          status: "Open", instrument: { name: "Wheat 2027", symbol: "WHEAT-2027", uri: "", supply: "500000000", decimals: 6 },
        }}
      />,
    );
    expect(screen.getByText("WHEAT-2027")).toBeInTheDocument();
    expect(screen.getByText("Fixed yield 8.0%")).toBeInTheDocument();
    expect(screen.getByText("$500.00 of $2,000.00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WHEAT-2027/ })).toHaveAttribute("href", "/pools/7");
  });
});

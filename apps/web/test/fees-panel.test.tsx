// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeesPanel } from "../src/components/admin/fees-panel";

const fees = { treasury: "CUAToHz2ZFs5WtuL826CUXBQcHiUcU37vEDo3CCXQPwF", networkFee: "500000", mintFee: "3000000", maxArrangementBps: 1_000, treasuryUsdc: "43500000" };
const sponsor = { address: "WQZQ1gM6N34zi4W89AcWnrUtU2hpCEFhwSTvy8AKCsx", lamports: 480_000_000 };

describe("FeesPanel", () => {
  it("shows FeeConfig, the treasury balance and the sponsor's SOL", () => {
    render(<FeesPanel fees={fees} sponsor={sponsor} expectedTreasury={fees.treasury} />);
    expect(screen.getByRole("heading", { name: "Platform fees" })).toBeInTheDocument();
    expect(screen.getByText("Network fee (investor)").nextSibling).toHaveTextContent("$0.50 per subscription");
    expect(screen.getByText("Mint fee (farmer)").nextSibling).toHaveTextContent("$3.00 per project");
    expect(screen.getByText("Arrangement fee cap").nextSibling).toHaveTextContent("10.0%");
    expect(screen.getByText("Treasury USDC").nextSibling).toHaveTextContent("$43.50");
    expect(screen.getByText("Gas sponsor SOL").nextSibling).toHaveTextContent("0.48 SOL");
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toContain(`https://explorer.solana.com/address/${fees.treasury}?cluster=devnet`);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when fees are not configured or the treasury differs from F2F_TREASURY", () => {
    const { unmount } = render(<FeesPanel fees={null} sponsor={null} expectedTreasury={undefined} />);
    expect(screen.getByText(/FeeConfig is not initialized/)).toBeInTheDocument();
    expect(screen.getByText(/F2F_SPONSOR_KEYPAIR is not set/)).toBeInTheDocument();
    unmount();
    render(<FeesPanel fees={fees} sponsor={sponsor} expectedTreasury="WQZQ1gM6N34zi4W89AcWnrUtU2hpCEFhwSTvy8AKCsx" />);
    expect(screen.getByRole("alert")).toHaveTextContent("F2F_TREASURY");
  });

  it("flags a sponsor running low on SOL", () => {
    render(<FeesPanel fees={fees} sponsor={{ ...sponsor, lamports: 40_000_000 }} expectedTreasury={fees.treasury} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Gas sponsor is low on SOL");
  });
});

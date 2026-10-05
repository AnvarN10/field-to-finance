// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { RevokeKyc } = await import("../src/components/compliance/revoke-kyc");
const { InvestorCard } = await import("../src/components/compliance/investor-card");
const { RetailMonitorTable } = await import("../src/components/compliance/retail-monitor");

const row = {
  userId: "u1",
  email: "inv@example.com",
  wallets: ["9nvestor1111111111111111111111111111111111"],
  profile: { userId: "u1", category: "retail", questionnaire: { answers: { netAssets: "100k-1m", experience: "some" }, kyc: { fullName: "Demo Investor", country: "Other", iin: "000000000000" } }, kycStatus: "approved", kycNote: null, riskAckAt: new Date(), decidedBy: null, decidedAt: null, updatedAt: new Date() },
} as never;

describe("compliance cabinet", () => {
  it("shows the investor's IIN to compliance and the retail limits", () => {
    render(<InvestorCard r={row} />);
    expect(screen.getByText("000000000000")).toBeInTheDocument();
    expect(screen.getByText(/fewer than 50 retail investors/)).toBeInTheDocument();
  });

  it("revocation needs a reason and names the consequence", async () => {
    const revoke = vi.fn(async () => ({ ok: true as const, message: "KYC revoked; holdings frozen", signatures: ["s"] }));
    render(<RevokeKyc revoke={revoke} />);
    await userEvent.click(screen.getByRole("button", { name: "Revoke KYC" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, revoke and freeze holdings" }));
    expect(revoke).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a reason of at least 3 characters.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Reason/), "Sanctions screening hit");
    await userEvent.click(screen.getByRole("button", { name: "Yes, revoke and freeze holdings" }));
    expect(revoke).toHaveBeenCalledWith("Sanctions screening hit");
  });

  it("retail monitor shows investors against the limit and flags amounts under the minimum", () => {
    render(<RetailMonitorTable rows={[{ poolId: "1", symbol: "F2F1", retailInvestors: 1, limit: 50, retailTotal: "80000000000", totalCap: "5000000000000", investors: [{ userId: "u1", email: "inv@example.com", amount: "80000000000", belowMinimum: true }] }]} />);
    expect(screen.getByText("1 of 49")).toBeInTheDocument();
    expect(screen.getByText("Below the USD 100,000 minimum")).toBeInTheDocument();
  });
});

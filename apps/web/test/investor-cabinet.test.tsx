// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@solana/wallet-adapter-react", () => ({ useWallet: () => ({ publicKey: null, connected: false, signMessage: undefined }) }));
vi.mock("../src/components/wallet/connect-button", () => ({ ConnectButton: () => <button type="button">Connect wallet</button> }));
const { Positions } = await import("../src/components/investor/positions");
const { OnboardingSteps } = await import("../src/components/investor/onboarding-steps");

const row = {
  poolId: "7",
  symbol: "DWHT27",
  wallet: "9nvestor1111111111111111111111111111111111",
  tokens: "2",
  holding: "200000000000",
  accrued: "3000000000",
  atMaturity: "212000000000",
  maturityTs: 1_900_000_000,
  settlement: "The issuer has not elected yet.",
  grainClaimKg: null as string | null,
  action: "View pool" as const,
};

describe("Positions", () => {
  it("shows tokens, nominal, accrued coupon, cash at maturity and the settlement path", () => {
    render(<Positions rows={[row]} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("$200,000.00")).toBeInTheDocument();
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
    expect(screen.getByText("$212,000.00")).toBeInTheDocument();
    expect(screen.getByText("The issuer has not elected yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View pool DWHT27" })).toHaveAttribute("href", "/pools/7");
  });

  it("offers the grain claim when delivery is open", () => {
    render(<Positions rows={[{ ...row, grainClaimKg: "60000", action: "Claim grain" }]} />);
    expect(screen.getByText("60 t")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Claim grain DWHT27" })).toHaveAttribute("href", "/investor/pools/7#invest");
  });

  it("invites browsing pools when there are no positions", () => {
    render(<Positions rows={[]} />);
    expect(screen.getByRole("link", { name: "Browse pools" })).toHaveAttribute("href", "/pools");
  });
});

describe("OnboardingSteps", () => {
  const base = { category: null, questionnaireDone: false, kycStatus: "not_started" as const, kycNote: null, riskAcknowledged: false, wallets: [], retailLimits: null, complete: false };
  it("starts with the questionnaire and keeps later steps waiting", () => {
    render(<OnboardingSteps userId="u1" state={base} />);
    expect(screen.getByRole("heading", { name: /1. Investor category/ })).toBeInTheDocument();
    expect(screen.getAllByText("Answer the questionnaire first.")).toHaveLength(2);
  });

  it("shows retail limits and the pending review", () => {
    render(<OnboardingSteps userId="u1" state={{ ...base, category: "retail", questionnaireDone: true, kycStatus: "pending", retailLimits: "Retail limits for this exempt offer: fewer than 50 retail investors in 12 months" }} />);
    expect(screen.getByText(/fewer than 50 retail investors/)).toBeInTheDocument();
    expect(screen.getByText("Waiting for review")).toBeInTheDocument();
  });

  it("says onboarding is complete with a way to the pools", () => {
    render(<OnboardingSteps userId="u1" state={{ ...base, category: "professional", questionnaireDone: true, kycStatus: "approved", riskAcknowledged: true, wallets: [{ address: row.wallet, kind: "phantom" }], complete: true }} />);
    expect(screen.getByText(/Onboarding complete/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse open pools" })).toHaveAttribute("href", "/pools");
  });
});

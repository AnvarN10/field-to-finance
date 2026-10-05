// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObligationItem } from "../src/components/farmer/obligations";

const runs: Record<string, ReturnType<typeof vi.fn>> = { "elect-settlement": vi.fn(), "fund-redemption": vi.fn() };
vi.mock("../src/components/tx/use-transaction", () => ({
  useTransaction: (action: string) => ({ state: { phase: "idle" }, busy: false, run: runs[action], retry: vi.fn(), reset: vi.fn() }),
}));
vi.mock("../src/components/use-json", () => ({ useJson: () => ({ data: { usdcBalance: "2000000000" }, error: null, loading: false, reload: vi.fn() }) }));
const { SettlementActions } = await import("../src/components/farmer/settlement-actions");

const WALLET = "FarmerWa11et1111111111111111111111111111111";
const signer = { publicKey: WALLET, sign: vi.fn() };
const NOW = 1_800_000_000;
const item = (o: Partial<ObligationItem> = {}): ObligationItem => ({
  poolId: "9",
  symbol: "DWHT27",
  issuer: WALLET,
  status: "Funded",
  settlementMode: "Hybrid",
  election: null,
  effectiveElection: null,
  principal: "1000000000",
  dueAtMaturity: "1010000000",
  accrued: "5000000",
  maturityTs: NOW + 86_400,
  lapseTs: NOW + 8 * 86_400,
  settlementLabel: "The issuer has not elected yet.",
  vaultBalance: "0",
  buybackShortfall: "1010000000",
  allDisbursed: true,
  ...o,
});

beforeEach(() => {
  for (const r of Object.values(runs)) r.mockReset();
});

describe("SettlementActions", () => {
  it("offers the election before maturity on a hybrid pool; delivery asks for confirmation", async () => {
    render(<SettlementActions item={item()} signer={signer} now={NOW} />);
    await userEvent.click(screen.getByRole("button", { name: "Elect buyback" }));
    expect(runs["elect-settlement"]).toHaveBeenCalledWith({ poolId: "9", election: "Buyback" });
    await userEvent.click(screen.getByRole("button", { name: "Elect delivery" }));
    expect(runs["elect-settlement"]).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Yes, elect delivery" }));
    expect(runs["elect-settlement"]).toHaveBeenLastCalledWith({ poolId: "9", election: "Delivery" });
  });

  it("funds the shortfall once buyback is elected, with the deadline and the lapse date", async () => {
    render(<SettlementActions item={item({ election: "Buyback", effectiveElection: "Buyback" })} signer={signer} now={NOW} />);
    expect(screen.queryByRole("button", { name: "Elect buyback" })).not.toBeInTheDocument();
    expect(screen.getByText(/Unfunded after .* the buyback lapses into delivery/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fund buyback · $1,010.00" }));
    expect(runs["fund-redemption"]).toHaveBeenCalledWith({ poolId: "9", amount: "1010000000" });
  });

  it("asks for the issuer wallet when another wallet is signed in, and says when nothing is left to do", () => {
    const { rerender } = render(<SettlementActions item={item()} signer={{ ...signer, publicKey: "Other1111111111111111111111111111111111111" }} now={NOW} />);
    expect(screen.getByText(/Sign in with the issuer wallet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elect buyback" })).not.toBeInTheDocument();
    rerender(<SettlementActions item={item({ election: "Buyback", effectiveElection: "Buyback", buybackShortfall: "0" })} signer={signer} now={NOW} />);
    expect(screen.getByText("The buyback is fully funded. Redemption opens after maturity.")).toBeInTheDocument();
  });
});

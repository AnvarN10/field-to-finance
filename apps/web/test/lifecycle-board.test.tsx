// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Phase } from "../src/lib/lifecycle";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../src/app/console/_actions/pools", () => ({
  closeSubscriptionAction: vi.fn(),
  disburseAllAction: vi.fn(),
  recordSettlementAllAction: vi.fn(),
  fundRedemptionAction: vi.fn(),
  sweepAction: vi.fn(),
  openPoolAction: vi.fn(),
}));
const { LifecycleBoard } = await import("../src/components/arranger/lifecycle-board");

const phases = (current: Partial<Phase>): Phase[] =>
  ["subscription", "funding", "season", "harvest", "settlement", "closing"].map((key, i) => ({
    key: key as Phase["key"],
    label: key,
    state: i < 1 ? "done" : i === 1 ? "current" : "todo",
    owner: i === 1 ? "arranger" : null,
    next: i === 1 ? "Disburse the proceeds" : "",
    ...(i === 1 ? current : {}),
  }));

describe("LifecycleBoard", () => {
  it("states each phase in text and gives the arranger the button for its own step", () => {
    render(<LifecycleBoard poolId="9" phases={phases({ action: "disburse" })} />);
    const steps = screen.getByRole("list", { name: "Pool lifecycle" });
    expect(within(steps).getAllByText("Done")[0]).toHaveClass("sr-only");
    expect(screen.getByText("Your step")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disburse the proceeds" })).toBeInTheDocument();
  });

  it("in a list it names the arranger's step without a button", () => {
    render(<LifecycleBoard poolId="9" phases={phases({ action: "disburse" })} compact />);
    expect(screen.getByText("Disburse the proceeds")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("names the owner and shows no button when another role acts", () => {
    render(<LifecycleBoard poolId="9" phases={phases({ owner: "lab", next: "Record a passing lab protocol" })} />);
    expect(screen.getByText("Laboratory")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says the pool is closed when every phase is done", () => {
    render(<LifecycleBoard poolId="9" phases={phases({}).map((p) => ({ ...p, state: "done", owner: null, next: "" }))} />);
    expect(screen.getByText("Every phase is complete.")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TxStatus } from "../src/components/tx/tx-status";

describe("TxStatus", () => {
  it("keeps one empty live region mounted while idle so later updates are announced", () => {
    const { rerender } = render(<TxStatus state={{ phase: "idle" }} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    rerender(<TxStatus state={{ phase: "signing" }} />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Approve in your wallet");
    rerender(<TxStatus state={{ phase: "confirming", signature: "5sig" }} />);
    expect(screen.getByRole("status")).toBe(region);
    expect(region).toHaveTextContent("Confirming on devnet");
    rerender(<TxStatus state={{ phase: "success", signature: "5sig" }} />);
    expect(screen.getByRole("status")).toBe(region);
  });

  it("shows success with an explorer link", () => {
    render(<TxStatus state={{ phase: "success", signature: "5sig" }} successLabel="Subscribed" />);
    expect(screen.getByText("Subscribed")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://explorer.solana.com/tx/5sig?cluster=devnet");
  });

  it("offers the way out for a KYC error and hides logs behind a disclosure", async () => {
    const onAction = vi.fn();
    render(
      <TxStatus
        state={{ phase: "error", error: { code: "KycRequired", title: "This wallet hasn't passed KYC", detail: "Complete KYC, then subscribe again.", action: "kyc" }, logs: ["Program log: x"] }}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This wallet hasn't passed KYC");
    await userEvent.click(screen.getByRole("button", { name: "Complete KYC" }));
    expect(onAction).toHaveBeenCalledWith("kyc");
    expect(screen.getByText("Program logs")).toBeInTheDocument();
  });

  it("offers the faucet for missing funds", () => {
    render(<TxStatus state={{ phase: "error", error: { code: "NoSol", title: "t", detail: "d", action: "faucet" }, logs: [] }} onAction={() => {}} />);
    expect(screen.getByRole("button", { name: "Get test funds" })).toBeInTheDocument();
  });
});

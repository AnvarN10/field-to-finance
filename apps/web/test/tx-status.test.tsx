// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TxStatus } from "../src/components/tx/tx-status";

describe("TxStatus", () => {
  it("renders nothing when idle and a live region otherwise", () => {
    const { container, rerender } = render(<TxStatus state={{ phase: "idle" }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TxStatus state={{ phase: "signing" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Approve in your wallet");
    rerender(<TxStatus state={{ phase: "confirming", signature: "5sig" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Confirming on devnet");
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

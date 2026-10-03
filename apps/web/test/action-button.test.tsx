// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActionButton } from "../src/components/admin/action-button";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ActionButton", () => {
  it("shows pending, then the message with an explorer link per signature", async () => {
    let resolve!: (v: unknown) => void;
    const action = vi.fn(() => new Promise((r) => (resolve = r)));
    render(<ActionButton label="Open pool" role="Issuer" action={action as never} />);
    await userEvent.click(screen.getByRole("button", { name: /Open pool/ }));
    expect(screen.getByRole("button", { name: /Open pool/ })).toBeDisabled();
    resolve({ ok: true, message: "Pool is open for subscription", signatures: ["5a", "5b"] });
    expect(await screen.findByText("Pool is open for subscription")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows the explained error with logs", async () => {
    const action = vi.fn(async () => ({ ok: false, error: { code: "FieldsNotVerified", title: "Some fields are not verified yet", detail: "d", action: "none" }, logs: ["Program log: x"] }));
    render(<ActionButton label="Add project" role="Issuer" action={action as never} />);
    await userEvent.click(screen.getByRole("button", { name: /Add project/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Some fields are not verified yet");
    expect(screen.getByText("Program logs")).toBeInTheDocument();
  });

  it("says why it is disabled", () => {
    render(<ActionButton label="Disburse" role="Issuer" action={vi.fn() as never} disabled disabledReason="Needs a Funded pool" />);
    expect(screen.getByRole("button", { name: /Disburse/ })).toBeDisabled();
    expect(screen.getByText("Needs a Funded pool")).toBeInTheDocument();
  });

  it("asks for confirmation inline when confirmText is set", async () => {
    const action = vi.fn(async () => ({ ok: true, message: "done", signatures: [] }));
    render(<ActionButton label="Sweep vault remainder" role="Issuer" action={action as never} confirmText="Return the vault remainder to the Issuer?" />);
    await userEvent.click(screen.getByRole("button", { name: "Sweep vault remainder" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Yes, sweep vault remainder" }));
    expect(action).toHaveBeenCalledOnce();
  });
});

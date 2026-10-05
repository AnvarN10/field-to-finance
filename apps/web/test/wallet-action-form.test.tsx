// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const approveInvestorAction = vi.fn(async (_w: string) => ({ ok: true, message: "Approved", signatures: [] }));
vi.mock("../src/app/arranger/actions", () => ({ approveInvestorAction, revokeInvestorAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { WalletActionForm } = await import("../src/components/admin/wallet-action-form");

describe("WalletActionForm", () => {
  it("says what is wrong with a mistyped address on the field itself", async () => {
    render(<WalletActionForm poolId="1" mode="approve" />);
    const input = screen.getByLabelText("Wallet to approve");
    await userEvent.type(input, "not-a-wallet");
    await userEvent.click(screen.getByRole("button", { name: /Approve investor/ }));
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(input).toHaveAccessibleDescription("Enter a Solana address: 32 to 44 base58 characters");
    expect(approveInvestorAction).not.toHaveBeenCalled();
  });

  it("uses 16px text on phones so iOS does not zoom", () => {
    render(<WalletActionForm poolId="1" mode="approve" />);
    expect(screen.getByLabelText("Wallet to approve").className).toContain("text-base");
  });
});

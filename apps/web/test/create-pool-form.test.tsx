// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const createPoolAction = vi.fn(async (_i: unknown) => ({ ok: true, message: "Pool 3 created as Draft", signatures: ["5s"] }));
vi.mock("../src/app/admin/actions", () => ({ createPoolAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { CreatePoolForm } = await import("../src/components/admin/create-pool-form");

describe("CreatePoolForm", () => {
  it("defaults to a demo pool that matures minutes from now", () => {
    render(<CreatePoolForm defaultPoolId="3" />);
    expect(screen.getByLabelText("Symbol")).toHaveValue("WHEAT-2027");
    expect(screen.getByLabelText("Fixed yield (%)")).toHaveValue("8.0");
    expect(screen.getByLabelText("Premium (%)")).toHaveValue("5.5");
    expect(screen.getByLabelText("Subscription closes in (minutes)")).toHaveValue("10");
    expect(screen.getByLabelText("Matures in (minutes)")).toHaveValue("20");
  });

  it("converts percentages to basis points", async () => {
    render(<CreatePoolForm defaultPoolId="3" />);
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    expect(createPoolAction).toHaveBeenCalledWith(expect.objectContaining({ poolId: "3", yieldBps: 800, premiumBps: 550, closeInMinutes: 10, maturityInMinutes: 20, season: 2027 }));
    expect(await screen.findByText("Pool 3 created as Draft")).toBeInTheDocument();
  });

  it("blocks a premium outside 5 to 6 percent before calling the server", async () => {
    createPoolAction.mockClear();
    render(<CreatePoolForm defaultPoolId="3" />);
    const premium = screen.getByLabelText("Premium (%)");
    await userEvent.clear(premium);
    await userEvent.type(premium, "7");
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    expect(premium).toHaveAttribute("aria-invalid", "true");
    expect(premium).toHaveAccessibleDescription("Premium must be between 5% and 6%");
    expect(premium).toHaveFocus();
    expect(createPoolAction).not.toHaveBeenCalled();
  });

  it("marks maturity invalid when it is not after the subscription close", async () => {
    createPoolAction.mockClear();
    render(<CreatePoolForm defaultPoolId="3" />);
    const maturity = screen.getByLabelText("Matures in (minutes)");
    await userEvent.clear(maturity);
    await userEvent.type(maturity, "5");
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    expect(maturity).toHaveAttribute("aria-invalid", "true");
    expect(maturity).toHaveAccessibleDescription("Maturity must come after the subscription close");
    expect(screen.getByLabelText("Premium (%)")).not.toHaveAttribute("aria-invalid");
    expect(createPoolAction).not.toHaveBeenCalled();
  });
});

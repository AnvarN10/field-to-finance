// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const createPoolAction = vi.fn(async (_i: unknown) => ({ ok: true, message: "Pool 3 created as Draft", signatures: ["5s"] }));
vi.mock("../src/app/arranger/actions", () => ({ createPoolAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { CreatePoolForm } = await import("../src/components/admin/create-pool-form");

describe("CreatePoolForm", () => {
  it("defaults to a demo pool that matures minutes from now", () => {
    render(<CreatePoolForm defaultPoolId="3" maxArrangementBps={1_000} />);
    expect(screen.getByLabelText("Symbol")).toHaveValue("WHEAT-2027");
    expect(screen.getByLabelText("Fixed yield (%)")).toHaveValue("8.0");
    expect(screen.getByLabelText("Premium (%)")).toHaveValue("5.5");
    expect(screen.getByLabelText("Subscription closes in (minutes)")).toHaveValue("10");
    expect(screen.getByLabelText("Matures in (minutes)")).toHaveValue("20");
    expect(screen.getByLabelText("Arrangement fee (%)")).toHaveValue("2.0");
    expect(screen.getByLabelText("Arrangement fee (%)")).toHaveAccessibleDescription("Paid by the farmer, withheld at disbursement. At most 10.0%.");
  });

  it("converts percentages to basis points", async () => {
    render(<CreatePoolForm defaultPoolId="3" maxArrangementBps={1_000} />);
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    expect(createPoolAction).toHaveBeenCalledWith(expect.objectContaining({ poolId: "3", yieldBps: 800, premiumBps: 550, arrangementFeeBps: 200, closeInMinutes: 10, maturityInMinutes: 20, season: 2027 }));
    expect(await screen.findByText("Pool 3 created as Draft")).toBeInTheDocument();
  });

  it("blocks a premium outside 5 to 6 percent before calling the server", async () => {
    createPoolAction.mockClear();
    render(<CreatePoolForm defaultPoolId="3" maxArrangementBps={1_000} />);
    const premium = screen.getByLabelText("Premium (%)");
    await userEvent.clear(premium);
    await userEvent.type(premium, "7");
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    // The check runs inside ActionButton's async transition.
    await waitFor(() => expect(premium).toHaveAttribute("aria-invalid", "true"));
    expect(premium).toHaveAccessibleDescription("Premium must be between 5% and 6%");
    expect(premium).toHaveFocus();
    expect(createPoolAction).not.toHaveBeenCalled();
  });

  it("marks maturity invalid when it is not after the subscription close", async () => {
    createPoolAction.mockClear();
    render(<CreatePoolForm defaultPoolId="3" maxArrangementBps={1_000} />);
    const maturity = screen.getByLabelText("Matures in (minutes)");
    await userEvent.clear(maturity);
    await userEvent.type(maturity, "5");
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    await waitFor(() => expect(maturity).toHaveAttribute("aria-invalid", "true"));
    expect(maturity).toHaveAccessibleDescription("Maturity must come after the subscription close");
    expect(screen.getByLabelText("Premium (%)")).not.toHaveAttribute("aria-invalid");
    expect(createPoolAction).not.toHaveBeenCalled();
  });

  it("blocks an arrangement fee above the FeeConfig cap", async () => {
    createPoolAction.mockClear();
    render(<CreatePoolForm defaultPoolId="3" maxArrangementBps={1_000} />);
    const fee = screen.getByLabelText("Arrangement fee (%)");
    await userEvent.clear(fee);
    await userEvent.type(fee, "12");
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    await waitFor(() => expect(fee).toHaveAttribute("aria-invalid", "true"));
    expect(fee).toHaveAccessibleDescription("Arrangement fee must be between 0% and 10.0%");
    expect(createPoolAction).not.toHaveBeenCalled();
  });

  it("sends a zero arrangement fee when fees are not configured", async () => {
    createPoolAction.mockClear();
    render(<CreatePoolForm defaultPoolId="3" maxArrangementBps={null} />);
    expect(screen.getByLabelText("Arrangement fee (%)")).toHaveValue("0.0");
    expect(screen.getByLabelText("Arrangement fee (%)")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    expect(createPoolAction).toHaveBeenCalledWith(expect.objectContaining({ arrangementFeeBps: 0 }));
  });
});

describe("CreatePoolForm for a pilot term sheet (ADR 0014)", () => {
  const farmer = "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm";
  it("sends the instrument terms with the issuer of record picked from approved farmers", async () => {
    createPoolAction.mockClear();
    render(<CreatePoolForm defaultPoolId="9" maxArrangementBps={1_000} farmers={[{ wallet: farmer, label: "Pilot farmer" }]} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Term sheet instrument/ }));
    expect(screen.getByLabelText("Nominal per token (USD)")).toHaveValue("100000");
    expect(screen.getByLabelText("Coupon (% a year, Act/360)")).toHaveValue("5.0");
    expect(screen.getByLabelText("Elevator")).toHaveValue("Ust-Kamenogorsk");
    expect(screen.getByLabelText("Laboratory")).toHaveValue("Baltic Control");
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    expect(createPoolAction).toHaveBeenCalledWith(
      expect.objectContaining({
        poolId: "9",
        instrument: expect.objectContaining({
          issuerOfRecord: farmer,
          unitNominalUsd: 100_000,
          couponBps: 500,
          settlementMode: "Hybrid",
          volumeTonnes: 10_000,
          tokenizedShareBps: 3_000,
          elevator: "Ust-Kamenogorsk",
          lab: "Baltic Control",
        }),
      }),
    );
  });

  it("needs an issuer of record", async () => {
    createPoolAction.mockClear();
    render(<CreatePoolForm defaultPoolId="9" maxArrangementBps={1_000} farmers={[]} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Term sheet instrument/ }));
    await userEvent.click(screen.getByRole("button", { name: /Create pool/ }));
    await waitFor(() => expect(screen.getByLabelText("Issuer of record (farmer wallet)")).toHaveAttribute("aria-invalid", "true"));
    expect(createPoolAction).not.toHaveBeenCalled();
  });
});

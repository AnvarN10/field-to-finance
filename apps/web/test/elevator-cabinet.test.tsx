// @vitest-environment jsdom
import { PILOT_QUALITY_SPEC } from "@f2f/sdk";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const recordLabAction = vi.fn(async (_p: string, _f: FormData) => ({ ok: true as const, message: "Lab protocol recorded", signatures: ["s"] }));
const recordReceiptAction = vi.fn(async (_p: string, _f: FormData) => ({ ok: true as const, message: "Elevator receipt recorded", signatures: ["s"] }));
vi.mock("../src/app/console/_actions/delivery", () => ({ recordLabAction: (p: string, f: FormData) => recordLabAction(p, f), recordReceiptAction: (p: string, f: FormData) => recordReceiptAction(p, f) }));
const { LabForm } = await import("../src/components/elevator/lab-form");
const { ReceiptForm } = await import("../src/components/elevator/receipt-form");

describe("elevator cabinet", () => {
  it("lab form shows the requirement per parameter and computes pass or fail as you type", async () => {
    render(<LabForm poolId="9" spec={PILOT_QUALITY_SPEC} />);
    const protein = screen.getByLabelText(/^Protein/);
    expect(screen.getAllByText("≥ 15%").length).toBeGreaterThan(0);
    expect(protein).toHaveAccessibleDescription("≥ 15%");
    await userEvent.type(protein, "14");
    expect(within(screen.getByRole("row", { name: /Protein/ })).getByText("Fails")).toBeInTheDocument();
    await userEvent.clear(protein);
    await userEvent.type(protein, "15.5");
    expect(within(screen.getByRole("row", { name: /Protein/ })).getByText("Passes")).toBeInTheDocument();
    expect(screen.getByText(/Verdict: insufficient data/)).toBeInTheDocument();
  });

  it("receipt form sends tonnes, number and date", async () => {
    render(<ReceiptForm poolId="9" elevator="Demo elevator" />);
    await userEvent.type(screen.getByLabelText(/Tonnes received/), "950");
    await userEvent.type(screen.getByLabelText(/Receipt number/), "RCPT-1");
    await userEvent.type(screen.getByLabelText(/Received on/), "2027-08-20");
    await userEvent.click(screen.getByRole("button", { name: "Record receipt" }));
    const fd = recordReceiptAction.mock.calls[0]?.[1] as FormData;
    expect([fd.get("tonnes"), fd.get("receiptNumber"), fd.get("receivedOn")]).toEqual(["950", "RCPT-1", "2027-08-20"]);
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const attestAction = vi.fn(async (_p: string, _f: FormData) => ({ ok: true as const, message: "Attestation recorded for every field", signatures: ["s1"] }));
vi.mock("../src/app/scas/actions", () => ({ attestAction: (p: string, f: FormData) => attestAction(p, f) }));
const { AttestForm } = await import("../src/components/scas/attest-form");

describe("AttestForm", () => {
  it("asks for the yield estimate only for the pre-harvest stage and sends the form", async () => {
    render(<AttestForm poolId="9" blocker={undefined} />);
    expect(screen.queryByLabelText(/Yield estimate/)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Stage"), "Harvest");
    await userEvent.type(screen.getByLabelText(/Yield estimate/), "3.2");
    await userEvent.type(screen.getByLabelText(/Observation/), "Grain filling");
    await userEvent.click(screen.getByRole("button", { name: "Record attestation" }));
    const fd = attestAction.mock.calls[0]?.[1] as FormData;
    expect(attestAction.mock.calls[0]?.[0]).toBe("9");
    expect([fd.get("kind"), fd.get("yield"), fd.get("note")]).toEqual(["Harvest", "3.2", "Grain filling"]);
    expect(await screen.findByText("Attestation recorded for every field")).toBeInTheDocument();
  });

  it("explains why it is unavailable", () => {
    render(<AttestForm poolId="9" blocker="Season attestations open once the pool is funded" />);
    expect(screen.getByRole("button", { name: "Record attestation" })).toBeDisabled();
    expect(screen.getByText("Season attestations open once the pool is funded")).toBeInTheDocument();
  });
});

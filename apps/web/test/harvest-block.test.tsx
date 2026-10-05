// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { HarvestBlock } = await import("../src/components/pool/harvest-block");
const { GrainClaims } = await import("../src/components/investor/grain-claims");

const receipt = { kind: "ElevatorReceipt" as const, verdict: "Pass" as const, poolId: "9", documentSha256: "aa".repeat(32), kg: "950000", receivedOn: "2027-08-20", receiptNumberSha256: "cc".repeat(32) };
const lab = {
  kind: "LabQuality" as const,
  verdict: "Pass" as const,
  poolId: "9",
  documentSha256: "bb".repeat(32),
  results: [
    { key: "protein", label: "Protein", requirement: "≥ 15%", measured: "15.2", pass: true },
    { key: "moisture", label: "Moisture", requirement: "14% (12%)", measured: "13.5", pass: true },
  ],
};

describe("HarvestBlock", () => {
  it("shows the elevator receipt and the lab result per parameter", () => {
    render(<HarvestBlock elevator="Demo elevator" lab="Demo lab" receipt={receipt} quality={lab} />);
    expect(screen.getByText("950 t")).toBeInTheDocument();
    expect(screen.getByText("Passed the quality spec")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Protein/ });
    expect(within(row).getByText("15.2")).toBeInTheDocument();
    expect(within(row).getByText("Passes")).toBeInTheDocument();
  });

  it("renders nothing before anything is recorded", () => {
    const { container } = render(<HarvestBlock elevator="E" lab="L" receipt={null} quality={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("GrainClaims", () => {
  it("lists each claim as a certificate with tonnes, elevator and lab result", () => {
    render(<GrainClaims claims={[{ id: "1", at: new Date("2027-09-01T10:00:00Z"), symbol: "DWHT27", poolId: "9", kg: "28500", elevator: "Demo elevator", lab: "Demo lab", labPassed: true, receiptHash: "aa".repeat(32), signature: "5sig" }]} cluster="devnet" />);
    const cert = screen.getByRole("listitem", { name: /Grain Claim DWHT27/ });
    expect(within(cert).getByText("28.5 t")).toBeInTheDocument();
    expect(within(cert).getByText("Demo elevator")).toBeInTheDocument();
    expect(within(cert).getByText("Passed")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AttestationView } from "../src/lib/chain/views";

const { SeasonTimeline } = await import("../src/components/pool/season-timeline");

const att = (kind: AttestationView["kind"], field: string, recordedAt: number): AttestationView => ({
  address: `Att${kind}${field}`.padEnd(43, "1"),
  field,
  project: "P",
  sequence: 0,
  kind,
  verdict: "Pass",
  evidenceHash: "ab".repeat(32),
  evidenceUri: `http://x/api/evidence/${kind}`,
  ndviMeanX10k: 0,
  sceneDate: recordedAt,
  signer: "S",
  recordedAt,
});

describe("SeasonTimeline", () => {
  it("shows each stage with how many fields are attested and the latest date", () => {
    render(<SeasonTimeline fieldCount={2} attestations={[att("FieldVerified", "f1", 1), att("FieldVerified", "f2", 2), att("Sowing", "f1", 1_800_000_000)]} cluster="devnet" />);
    const sowing = screen.getByRole("listitem", { name: /Sowing/ });
    expect(within(sowing).getByText("1 of 2 fields")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: /Field verification/ })).getByText("2 of 2 fields")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: /Yield estimate and harvest/ })).getByText("Not yet attested")).toBeInTheDocument();
    expect(within(sowing).getByRole("link", { name: "Evidence" })).toHaveAttribute("href", "http://x/api/evidence/Sowing");
  });
});

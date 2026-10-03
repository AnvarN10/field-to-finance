// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttestationTimeline } from "../src/components/field/attestation-timeline";
import type { AttestationView } from "../src/lib/chain/views";

const att = (kind: AttestationView["kind"], sequence: number): AttestationView => ({
  address: `Att${sequence}111111111111111111111111111111111111111`,
  field: "F", project: "P", sequence, kind, verdict: "Pass",
  evidenceHash: "ab".repeat(32),
  evidenceUri: `https://f2f-web.up.railway.app/api/evidence/${"ab".repeat(32)}`,
  ndviMeanX10k: 0, sceneDate: 1_791_000_000, signer: "S", recordedAt: 1_791_000_000 + sequence,
});

describe("AttestationTimeline", () => {
  it("shows four stages with done and pending states", () => {
    render(<AttestationTimeline attestations={[att("FieldVerified", 0), att("Sowing", 1)]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(within(items[0]!).getByText("Field verified")).toBeInTheDocument();
    expect(within(items[0]!).getByText("Pass")).toBeInTheDocument();
    expect(within(items[0]!).getByRole("link", { name: "Evidence JSON" })).toHaveAttribute("href", att("FieldVerified", 0).evidenceUri);
    expect(within(items[2]!).getByText("Not yet attested")).toBeInTheDocument();
  });

  it("always shows the stub badge", () => {
    render(<AttestationTimeline attestations={[]} />);
    expect(screen.getByText("Verified by SCAS stub: external provider pending")).toBeInTheDocument();
  });

  it("uses the latest attestation when a stage was attested twice", () => {
    render(<AttestationTimeline attestations={[att("Sowing", 1), att("Sowing", 4)]} />);
    const sowing = screen.getAllByRole("listitem")[1]!;
    expect(within(sowing).getByText(/2 attestations/)).toBeInTheDocument();
  });
});

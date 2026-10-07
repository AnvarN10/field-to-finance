// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApplicationList } from "../src/components/farmer/application-list";
import { DocumentChecklist } from "../src/components/farmer/document-checklist";
import { Obligations } from "../src/components/farmer/obligations";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const app = { id: "a1", crop: "wheat", season: 2027, requestedUsd: 200000, status: "documents_review" as const, statusNote: null };

describe("ApplicationList", () => {
  it("invites the first application when there is none", () => {
    render(<ApplicationList applications={[]} canCreate />);
    expect(screen.getByRole("link", { name: "Start your first application" })).toHaveAttribute("href", "/issuer/applications/new");
  });

  it("shows status, next action and who owns it", () => {
    render(<ApplicationList applications={[app]} canCreate />);
    expect(screen.getByText("Document review")).toBeInTheDocument();
    expect(screen.getByText("F2F is reviewing your documents")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open wheat 2027/ })).toHaveAttribute("href", "/issuer/applications/a1");
  });

  it("marks the farmer's own step", () => {
    render(<ApplicationList applications={[{ ...app, status: "draft" }]} canCreate />);
    expect(screen.getByText(/· Your step/)).toBeInTheDocument();
  });
});

describe("DocumentChecklist", () => {
  const rows = [
    { kind: "insurance" as const, label: "Crop insurance", status: "accepted" as const, documentId: "d1", sha256: "a".repeat(64), note: null },
    { kind: "land_act" as const, label: "Land-use right", status: "rejected" as const, documentId: "d2", sha256: "b".repeat(64), note: "The act is not signed" },
    { kind: "yields" as const, label: "Historical field yields", status: "missing" as const, documentId: null, sha256: null, note: null },
  ];

  it("states each document's status in words and shows the rejection reason", () => {
    render(<DocumentChecklist rows={rows} editable="rejected-only" upload={vi.fn()} />);
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("The act is not signed")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("offers an upload only where it is allowed", () => {
    render(<DocumentChecklist rows={rows} editable="rejected-only" upload={vi.fn()} />);
    expect(screen.queryByLabelText("Upload Crop insurance")).toBeNull();
    expect(screen.getByLabelText("Replace Land-use right")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload Historical field yields")).toBeInTheDocument();
  });

  it("uploads the chosen file for its row and shows the result", async () => {
    const upload = vi.fn(async () => ({ ok: true as const }));
    render(<DocumentChecklist rows={rows} editable="all" upload={upload} />);
    await userEvent.upload(screen.getByLabelText("Upload Historical field yields"), new File(["%PDF"], "y.pdf", { type: "application/pdf" }));
    expect(upload).toHaveBeenCalledWith("yields", expect.any(FormData));
  });

  it("shows an upload error next to its row", async () => {
    const upload = vi.fn(async () => ({ ok: false as const, error: "Documents are limited to 10 MB" }));
    render(<DocumentChecklist rows={rows} editable="all" upload={upload} />);
    await userEvent.upload(screen.getByLabelText("Upload Historical field yields"), new File(["%PDF"], "y.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Documents are limited to 10 MB");
  });
});

describe("Obligations", () => {
  const base = { poolId: "9", issuer: "W", status: "Funded" as const, settlementMode: null, election: null, effectiveElection: null, lapseTs: 1_800_604_800, allDisbursed: true, symbol: "DWHT27", principal: "200000000000", dueAtMaturity: "212000000000", accrued: "2000000000", maturityTs: 1_800_000_000, settlementLabel: "The issuer has not elected yet.", vaultBalance: "0", buybackShortfall: "212000000000" };
  it("shows the amount due, accrual to date, maturity and the buyback shortfall", () => {
    render(<Obligations items={[base]} />);
    expect(screen.getByText("$212,000.00")).toBeInTheDocument();
    expect(screen.getByText("$2,000.00")).toBeInTheDocument();
    expect(screen.getByText(/Short by \$212,000.00/)).toBeInTheDocument();
    expect(screen.getByText("The issuer has not elected yet.")).toBeInTheDocument();
  });
  it("says funded once the vault covers the buyback", () => {
    render(<Obligations items={[{ ...base, vaultBalance: "212000000000", buybackShortfall: "0" }]} />);
    expect(screen.getByText("Funded")).toBeInTheDocument();
  });
  it("names the funding deadline and, on a hybrid pool, the lapse into delivery", () => {
    render(<Obligations items={[{ ...base, settlementMode: null }]} />);
    expect(screen.getByText("Funding deadline")).toBeInTheDocument();
  });
  it("on the delivery path the buyback is not needed and the card says grain, not cash", () => {
    render(<Obligations items={[{ ...base, effectiveElection: "Delivery" }]} />);
    expect(screen.getByText("Not needed: grain delivery")).toBeInTheDocument();
    expect(screen.queryByText(/Short by/)).not.toBeInTheDocument();
  });
  it("names the pool next to the symbol", () => {
    render(<Obligations items={[base]} />);
    expect(screen.getByRole("heading", { name: "DWHT27 · pool 9" })).toBeInTheDocument();
  });
  it("renders nothing without pools", () => {
    const { container } = render(<Obligations items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

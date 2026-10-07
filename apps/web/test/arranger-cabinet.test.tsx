// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const structureAction = vi.fn(async () => ({ ok: true as const, message: "Pool 9 created", signatures: ["s1", "s2"] }));
const grantRoleAction = vi.fn(async () => ({ ok: false as const, error: { code: "BadRequest", title: "enter a valid email", detail: "", action: "none" as const }, logs: [] }));
vi.mock("../src/app/console/_actions/applications", () => ({ structureAction: (...a: unknown[]) => structureAction(...(a as [])), grantRoleAction: (...a: unknown[]) => grantRoleAction(...(a as [])) }));
const { PipelineBoard } = await import("../src/components/arranger/pipeline-board");
const { TermBuilder } = await import("../src/components/arranger/term-builder");
const { RoleForm } = await import("../src/components/arranger/role-form");
const { AuditTable } = await import("../src/components/arranger/audit-table");

const row = (id: string, status: string) => ({ id, crop: "wheat", season: 2027, requestedUsd: 1000000, status, farmerEmail: `${id}@example.com`, legalName: "Demo Farm LLP", updatedAt: new Date("2026-10-05T10:00:00Z") });

describe("PipelineBoard", () => {
  it("groups applications into stages with counts and links each card", () => {
    render(<PipelineBoard rows={[row("a", "submitted"), row("b", "documents_review"), row("c", "open"), row("d", "draft")] as never} filter={null} />);
    const intake = screen.getByRole("region", { name: /Intake/ });
    expect(within(intake).getByText("2")).toBeInTheDocument();
    expect(within(intake).getAllByRole("link")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /Demo Farm LLP.*wheat 2027/i })).toHaveLength(3);
    expect(screen.getByText(/1 draft is still with farmers/)).toBeInTheDocument();
  });

  it("filters to one status", () => {
    render(<PipelineBoard rows={[row("a", "submitted"), row("b", "documents_review")] as never} filter={"submitted" as never} />);
    expect(screen.getAllByRole("link", { name: /Demo Farm LLP/ })).toHaveLength(1);
  });
});

describe("TermBuilder", () => {
  it("prefills from the application and sends whole-number terms", async () => {
    render(<TermBuilder applicationId="app1" requestedUsd={1000000} defaults={{ name: "Demo wheat 2027", symbol: "DWHT27", unitNominalUsd: 100000, couponBps: 1200, settlementMode: "Hybrid", closeInMinutes: 60, maturityInMinutes: 600, arrangementFeeBps: 200 }} maxArrangementBps={500} />);
    expect(screen.getByText(/10 tokens of \$100,000.00/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create the pool and add the project" }));
    expect(structureAction).toHaveBeenCalledWith("app1", { name: "Demo wheat 2027", symbol: "DWHT27", unitNominalUsd: 100000, couponBps: 1200, settlementMode: "Hybrid", closeInMinutes: 60, maturityInMinutes: 600, arrangementFeeBps: 200 });
    expect(await screen.findByText("Pool 9 created")).toBeInTheDocument();
  });

  it("warns before sending when the nominal does not divide the amount", async () => {
    structureAction.mockClear();
    render(<TermBuilder applicationId="app1" requestedUsd={1000000} defaults={{ name: "D", symbol: "D", unitNominalUsd: 300000, couponBps: 1200, settlementMode: "Hybrid", closeInMinutes: 60, maturityInMinutes: 600, arrangementFeeBps: 200 }} maxArrangementBps={500} />);
    expect(screen.getByText(/must divide/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create the pool and add the project" })).toBeDisabled();
  });
});

describe("RoleForm", () => {
  it("shows the server's refusal", async () => {
    render(<RoleForm />);
    await userEvent.type(screen.getByLabelText("Email"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Grant role" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("enter a valid email");
  });
});

describe("AuditTable", () => {
  it("links signatures to the explorer and shows failures", () => {
    render(
      <AuditTable
        cluster="devnet"
        rows={[
          { id: "1", at: new Date("2026-10-05T10:00:00Z"), actor: "ops@example.com", action: "pool.open", target: "pool 7", detail: "", signature: "5".repeat(88), error: null },
          { id: "2", at: new Date("2026-10-05T10:01:00Z"), actor: "ops@example.com", action: "farmer_kyc.approve", target: "user", detail: "", signature: null, error: "compliance key has no SOL" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /5555/ })).toHaveAttribute("href", expect.stringContaining("explorer.solana.com/tx/"));
    expect(screen.getByText("Failed: compliance key has no SOL")).toBeInTheDocument();
  });
});

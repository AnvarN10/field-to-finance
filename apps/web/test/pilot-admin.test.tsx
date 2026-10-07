// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { InstrumentTermsView, PoolView } from "../src/lib/chain/views";

const ok = { ok: true as const, message: "done", signatures: ["5sig"] };
const electSettlementAction = vi.fn(async (..._a: unknown[]) => ok);
const recordDeliveryAction = vi.fn(async (..._a: unknown[]) => ok);
const adminMintUsdcAction = vi.fn(async (..._a: unknown[]) => ok);
const rows = [
  { key: "insurance", label: "Crop insurance", status: "missing" },
  { key: "kyc", label: "Full KYC of the issuer", status: "provided" },
];
const onboardingStatusAction = vi.fn(async (..._a: unknown[]) => ({ ok: true as const, rows }));
const uploadOnboardingDocumentAction = vi.fn(async (..._a: unknown[]) => ({ ok: true as const, rows: [{ ...rows[0], status: "provided", sha256: "ab".repeat(32) }, rows[1]] }));
const saveFieldSetAction = vi.fn(async (..._a: unknown[]) => ({ ok: true as const, hash: "cd".repeat(32) }));
vi.mock("../src/app/console/_actions/pools", () => ({
  electSettlementAction,
  recordDeliveryAction,
  adminMintUsdcAction,
  onboardingStatusAction,
  uploadOnboardingDocumentAction,
  saveFieldSetAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { TermSheetConsole } = await import("../src/components/admin/term-sheet-console");
const { MintUsdcForm } = await import("../src/components/admin/mint-usdc-form");
const { OnboardingPanel } = await import("../src/components/admin/onboarding-panel");
const { FieldImport } = await import("../src/components/admin/field-import");

const WALLET = "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm";
const terms = (o: Partial<InstrumentTermsView> = {}): InstrumentTermsView => ({
  unitNominal: "100000000000", couponBpsAnnual: 500, dayCount: "Act360", startTs: 0, settlementMode: "Hybrid", volumeKg: "10000000",
  tokenizedShareBps: 3_000, qualitySpecHash: "ab".repeat(32), specUri: "", elevator: "Ust-Kamenogorsk", lab: "Baltic Control",
  election: null, electedAt: 0, receiptHash: null, labCertHash: null, labPassed: false, deliveredKg: "0", ...o,
});
const pool = { poolId: "9", status: "Funded", maturityTs: 2_000, raisedAmount: "1000000000000" } as PoolView;

describe("TermSheetConsole", () => {
  it("lets the arranger elect buyback or delivery for a Hybrid pool before maturity", async () => {
    render(<TermSheetConsole pool={pool} terms={terms()} now={1_000} />);
    await userEvent.click(screen.getByRole("button", { name: "Elect buyback" }));
    expect(electSettlementAction).toHaveBeenCalledWith("9", "Buyback");
    expect(screen.getByRole("button", { name: "Elect delivery" })).toBeEnabled();
  });

  it("explains why the election is closed", () => {
    render(<TermSheetConsole pool={pool} terms={terms({ election: "Buyback" })} now={1_000} />);
    expect(screen.getByRole("button", { name: "Elect buyback" })).toBeDisabled();
    expect(screen.getAllByText("Already elected").length).toBeGreaterThan(0);
  });

  it("records a delivery document with its verdict once delivery applies", async () => {
    render(<TermSheetConsole pool={pool} terms={terms({ election: "Delivery" })} now={1_000} />);
    const form = screen.getByRole("form", { name: "Record delivery document" });
    await userEvent.selectOptions(within(form).getByLabelText("Document"), "LabQuality");
    await userEvent.upload(within(form).getByLabelText("File"), new File(["%PDF"], "cert.pdf", { type: "application/pdf" }));
    await userEvent.click(within(form).getByRole("button", { name: "Record lab certificate" }));
    await waitFor(() => expect(recordDeliveryAction).toHaveBeenCalled());
    const fd = recordDeliveryAction.mock.calls[0]![1] as FormData;
    expect(fd.get("kind")).toBe("LabQuality");
    expect(fd.get("verdict")).toBe("Pass");
    expect((fd.get("file") as File).name).toBe("cert.pdf");
  });

  it("hides delivery recording on a buyback pool", () => {
    render(<TermSheetConsole pool={pool} terms={terms({ settlementMode: "CashBuyback" })} now={1_000} />);
    expect(screen.queryByRole("form", { name: "Record delivery document" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Elect buyback" })).toBeNull();
  });
});

describe("PoolConsole funding guard", () => {
  it("names the reason fund redemption waits on a Hybrid pool", async () => {
    const { fundRedemptionReason } = await import("../src/lib/instrument-terms");
    expect(fundRedemptionReason(pool, terms(), 1_000)).toBe("Elect buyback first: cash is accepted only on the buyback path");
    expect(fundRedemptionReason(pool, terms({ election: "Buyback" }), 1_000)).toBeUndefined();
    expect(fundRedemptionReason(pool, terms({ election: "Delivery" }), 1_000)).toMatch(/grain delivery applies/i);
    expect(fundRedemptionReason(pool, terms({ settlementMode: "CashBuyback" }), 1_000)).toBeUndefined();
  });
});

describe("MintUsdcForm", () => {
  it("mints a demo investor's $1,000,000 of test USDC", async () => {
    render(<MintUsdcForm />);
    await userEvent.type(screen.getByLabelText("Wallet"), WALLET);
    await userEvent.clear(screen.getByLabelText("Amount (USD)"));
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "1000000");
    await userEvent.click(screen.getByRole("button", { name: "Mint test USDC" }));
    expect(adminMintUsdcAction).toHaveBeenCalledWith(WALLET, 1_000_000);
  });

  it("checks the amount before calling the server", async () => {
    adminMintUsdcAction.mockClear();
    render(<MintUsdcForm />);
    await userEvent.type(screen.getByLabelText("Wallet"), WALLET);
    await userEvent.clear(screen.getByLabelText("Amount (USD)"));
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "6000000");
    await userEvent.click(screen.getByRole("button", { name: "Mint test USDC" }));
    await waitFor(() => expect(screen.getByLabelText("Amount (USD)")).toHaveAttribute("aria-invalid", "true"));
    expect(adminMintUsdcAction).not.toHaveBeenCalled();
  });
});

describe("OnboardingPanel", () => {
  it("loads a farmer's checklist and uploads a missing document", async () => {
    render(<OnboardingPanel />);
    await userEvent.type(screen.getByLabelText("Farmer wallet"), WALLET);
    await userEvent.click(screen.getByRole("button", { name: "Show checklist" }));
    const list = await screen.findByRole("list", { name: "Onboarding checklist" });
    const insurance = within(list).getByText("Crop insurance").closest("li")!;
    expect(insurance).toHaveTextContent("Pending");
    await userEvent.upload(within(insurance).getByLabelText("Upload Crop insurance"), new File(["%PDF"], "policy.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(uploadOnboardingDocumentAction).toHaveBeenCalled());
    const fd = uploadOnboardingDocumentAction.mock.calls[0]![0] as FormData;
    expect(fd.get("wallet")).toBe(WALLET);
    expect(fd.get("requirement")).toBe("insurance");
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Onboarding checklist" })).getByText("Crop insurance").closest("li")).toHaveTextContent("Provided"));
  });
});

describe("FieldImport", () => {
  const ring = (x: number) => [[x, 49.9], [x + 0.01, 49.9], [x + 0.01, 49.91], [x, 49.91], [x, 49.9]];
  const geojson = JSON.stringify({
    type: "Feature",
    properties: { name: "Block A", cadastral: "05-000-000-001" },
    geometry: { type: "MultiPolygon", coordinates: [[ring(82.6)], [ring(82.7)]] },
  });

  it("splits a MultiPolygon, keeps cadastral numbers and saves the field set", async () => {
    const fetchMock = vi.fn(async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return Response.json({ polygonHash: (body.geometry.coordinates[0][0][0] > 82.65 ? "bb" : "aa").repeat(32), areaHa: 79.5, areaHaX100: 7950, polygon: body.geometry });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<FieldImport />);
    await userEvent.upload(screen.getByLabelText("Boundaries file (GeoJSON or KML)"), new File([geojson], "farm.geojson", { type: "application/geo+json" }));
    const table = await screen.findByRole("table", { name: "Imported fields" });
    expect(within(table).getByText("Block A · part 1")).toBeInTheDocument();
    expect(within(table).getAllByDisplayValue("05-000-000-001")).toHaveLength(2);
    await userEvent.type(within(table).getAllByLabelText(/Declared area/)[0]!, "100");
    expect(within(table).getByText("-20.5%")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save field set" }));
    await waitFor(() => expect(saveFieldSetAction).toHaveBeenCalled());
    const entries = saveFieldSetAction.mock.calls[0]![0] as { polygonHash: string; cadastralNumber: string; declaredAreaHa: number | null }[];
    expect(entries.map((e) => e.polygonHash)).toEqual(["aa".repeat(32), "bb".repeat(32)]);
    expect(entries[0]).toMatchObject({ cadastralNumber: "05-000-000-001", declaredAreaHa: 100 });
    expect(await screen.findByText(/Field set saved/)).toBeInTheDocument();
  });
});

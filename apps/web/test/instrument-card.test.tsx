// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InstrumentCard } from "../src/components/pool/instrument-card";
import type { PoolDetail } from "../src/lib/chain/views";

const detail: PoolDetail = {
  pool: {
    address: "PooL1111111111111111111111111111111111111111", poolId: "7", issuer: "IssU1111111111111111111111111111111111111111",
    mint: "MinT1111111111111111111111111111111111111111", vault: "VauL1111111111111111111111111111111111111111",
    crop: "wheat", season: 2027, targetAmount: "2000000000", raisedAmount: "500000000", yieldBps: 800, premiumBps: 550,
    subscriptionCloseTs: 1_791_000_600, maturityTs: 1_791_001_200, projectCount: 1, disbursedCount: 0, settledCount: 0, status: "Open",
    instrument: { name: "Wheat 2027", symbol: "WHEAT-2027", uri: "", supply: "500000000", decimals: 6 },
  },
  projects: [
    {
      address: "ProJ1111111111111111111111111111111111111111", producer: "ProD1111111111111111111111111111111111111111", projectId: "1",
      pool: "PooL1111111111111111111111111111111111111111", crop: "wheat", season: 2027, expectedKg: "400000", tokenizedKg: "120000",
      requestedAmount: "2000000000", fieldCount: 2, verifiedFieldCount: 2, harvestAttested: false, disbursed: false, settlement: null,
      fields: [],
    },
  ],
  arrangementFeeBps: 0,
};

describe("InstrumentCard", () => {
  it("shows every element of the Instrument card from the business context", () => {
    render(<InstrumentCard detail={detail} />);
    for (const heading of ["Issuer", "Farm projects", "SCAS checks", "Amount", "Term", "Fixed yield", "Shortfall rules", "Risks", "Status"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText("Fixed yield 8.0%")).toBeInTheDocument();
    expect(screen.getByText("$1,080.00 back for every $1,000.00")).toBeInTheDocument();
    expect(screen.getByText(/repays in USD with a 5.5% premium/)).toBeInTheDocument();
    expect(screen.getByText(/freeze authority/i)).toBeInTheDocument();
    expect(screen.getByText("2 of 2 fields verified")).toBeInTheDocument();
  });

  it("links the pool, mint and vault to the explorer", () => {
    render(<InstrumentCard detail={detail} />);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    for (const k of [detail.pool.address, detail.pool.mint, detail.pool.vault, detail.pool.issuer, detail.projects[0]!.producer]) {
      expect(links).toContain(`https://explorer.solana.com/address/${k}?cluster=devnet`);
    }
  });

  it("exposes the funding meter to assistive tech", () => {
    render(<InstrumentCard detail={detail} />);
    const meter = screen.getByRole("meter", { name: "Raised" });
    expect(meter).toHaveAttribute("aria-valuenow", "25");
    expect(within(meter.parentElement as HTMLElement).getByText("25.0% funded")).toBeInTheDocument();
  });
});

describe("InstrumentCard fees (COB 4.4 disclosure)", () => {
  it("shows the arrangement fee and what the farmer nets", () => {
    render(<InstrumentCard detail={{ ...detail, arrangementFeeBps: 200 }} networkFee="500000" />);
    const fees = screen.getByRole("heading", { name: "Fees" }).parentElement as HTMLElement;
    expect(within(fees).getByText("Arrangement fee (2.0%)").nextSibling).toHaveTextContent("$40.00");
    expect(within(fees).getByText("Farmer receives").nextSibling).toHaveTextContent("$1,960.00");
    expect(within(fees).getByText(/\$0.50 network fee/)).toBeInTheDocument();
  });

  it("says a pool without terms has no arrangement fee", () => {
    render(<InstrumentCard detail={detail} networkFee={null} />);
    const fees = screen.getByRole("heading", { name: "Fees" }).parentElement as HTMLElement;
    expect(within(fees).getByText("No arrangement fee on this pool.")).toBeInTheDocument();
    expect(within(fees).getByText("Farmer receives").nextSibling).toHaveTextContent("$2,000.00");
  });
});

describe("ProjectsTable scroll container", () => {
  it("is a keyboard-focusable named region, so Safari users can scroll it", () => {
    render(<InstrumentCard detail={detail} />);
    const region = screen.getByRole("region", { name: "Farm projects table" });
    expect(region).toHaveAttribute("tabindex", "0");
  });
});

describe("InstrumentCard as a term sheet (ADR 0014)", () => {
  const NOMINAL = "100000000000";
  const pilot: PoolDetail = {
    ...detail,
    pool: { ...detail.pool, targetAmount: "1000000000000", raisedAmount: "300000000000", maturityTs: 1_800_000_000 + 300 * 86_400, yieldBps: 500 },
    terms: {
      unitNominal: NOMINAL, couponBpsAnnual: 500, dayCount: "Act360", startTs: 1_800_000_000, settlementMode: "Hybrid",
      volumeKg: "10000000", tokenizedShareBps: 3_000, qualitySpecHash: "ab".repeat(32), specUri: "https://x/api/evidence/ab",
      elevator: "Ust-Kamenogorsk", lab: "Baltic Control", election: null, electedAt: 0, receiptHash: null, labCertHash: null, labPassed: false, deliveredKg: "0",
    },
    issuerKycApproved: true,
  };
  const spec = { version: 1 as const, crop: "wheat", class: "HiPro (class 3)", parameters: [{ key: "protein", label: "Protein", requirement: "≥ 15%" }] };
  const requirements = [
    { key: "insurance" as const, label: "Crop insurance", status: "provided" as const, sha256: "cd".repeat(32) },
    { key: "field_imagery" as const, label: "Field imagery", status: "missing" as const },
    { key: "kyc" as const, label: "Full KYC of the issuer", status: "provided" as const },
  ];

  it("shows the farmer as issuer with KYC, and the instrument terms of the term sheet", () => {
    render(<InstrumentCard detail={pilot} spec={spec} requirements={requirements} />);
    for (const heading of ["Issuer", "Instrument", "Settlement", "Commodity", "Volume and delivery", "Farmer requirements", "Fees", "Risks"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText("KYC passed")).toBeInTheDocument();
    expect(screen.getByText("Hybrid: grain delivery with the issuer's right to buy the token back")).toBeInTheDocument();
    expect(screen.getByText("$100,000.00")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("$1,000,000.00")).toBeInTheDocument();
    expect(screen.getByText("5.0% a year, Act/360")).toBeInTheDocument();
    expect(screen.getByText("$104,166.66 per token")).toBeInTheDocument();
    expect(screen.getByText("Ust-Kamenogorsk")).toBeInTheDocument();
    expect(screen.getByText("Baltic Control")).toBeInTheDocument();
    expect(screen.getByText("10,000 t")).toBeInTheDocument();
    expect(screen.getByText("30.0% (3,000 t)")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Fixed yield" })).toBeNull();
  });

  it("lists the commodity spec and the farmer requirements with document status", () => {
    render(<InstrumentCard detail={pilot} spec={spec} requirements={requirements} />);
    const table = screen.getByRole("table", { name: "Commodity specification" });
    expect(within(table).getByText("Protein")).toBeInTheDocument();
    expect(within(table).getByText("≥ 15%")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Farmer requirements" });
    expect(within(list).getByText("Crop insurance").closest("li")).toHaveTextContent("Provided");
    expect(within(list).getByText("Field imagery").closest("li")).toHaveTextContent("Pending");
  });
});

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

describe("ProjectsTable scroll container", () => {
  it("is a keyboard-focusable named region, so Safari users can scroll it", () => {
    render(<InstrumentCard detail={detail} />);
    const region = screen.getByRole("region", { name: "Farm projects table" });
    expect(region).toHaveAttribute("tabindex", "0");
  });
});

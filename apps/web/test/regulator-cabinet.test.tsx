// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { RegistryTable, HoldersTable } = await import("../src/components/regulator/tables");

describe("regulator tables", () => {
  it("registry rows link to the pool and show the issuer's BIN", () => {
    render(<RegistryTable rows={[{ poolId: "9", symbol: "DWHT27", status: "Funded", issuerWallet: "FarmerWa11et1111111111111111111111111111111", issuerLegalName: "Demo Farm LLP", issuerBin: "000000000000", raised: "1000000000", target: "1000000000", couponBps: 1200, settlementMode: "Hybrid", maturityTs: 1_800_000_000, holders: 3 }]} />);
    const row = screen.getByRole("row", { name: /DWHT27/ });
    expect(within(row).getByRole("link", { name: "DWHT27" })).toHaveAttribute("href", "/regulator/pools/9");
    expect(within(row).getByText("000000000000")).toBeInTheDocument();
    expect(within(row).getByText("$1,000.00")).toBeInTheDocument();
  });

  it("holders show category and IIN, or a dash for unlinked wallets", () => {
    render(<HoldersTable rows={[{ poolId: "9", wallet: "9nvestor1111111111111111111111111111111111", balance: "300000000", category: "retail", iin: null }]} />);
    expect(screen.getByText("Retail")).toBeInTheDocument();
    expect(screen.getByText("$300.00")).toBeInTheDocument();
  });
});

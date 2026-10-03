// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypair } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wallet = Keypair.generate().publicKey;
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({ publicKey: wallet, connected: true, sendTransaction: vi.fn() }),
  useConnection: () => ({ connection: {} }),
}));
vi.mock("../src/components/wallet/connect-button", () => ({ ConnectButton: () => <button type="button">Connect</button> }));

const { PortfolioView } = await import("../src/components/portfolio/portfolio-view");

const state = (approved: boolean) => ({
  wallet: wallet.toBase58(), approved, approvedAt: null, usdcBalance: "1000000000", solLamports: 50_000_000,
  positions: [
    { poolId: "7", pool: "A", symbol: "WHEAT-2027", status: "Open", yieldBps: 800, ata: "X", exists: true, frozen: false, balance: "5000000" },
    { poolId: "8", pool: "B", symbol: "BARLEY-27", status: "Open", yieldBps: 800, ata: "Y", exists: true, frozen: false, balance: "5000000" },
  ],
});

let approved = false;
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.startsWith("/api/investor/")) return Response.json(state(approved));
    throw new Error(`unexpected fetch ${url}`);
  }));
});

describe("PortfolioView", () => {
  it("offers Complete KYC from the KYC tile when the wallet is not approved", async () => {
    approved = false;
    render(<PortfolioView />);
    expect(await screen.findByText("Not completed")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Complete KYC" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  it("shows Approved and no KYC action once approved", async () => {
    approved = true;
    render(<PortfolioView />);
    expect(await screen.findByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete KYC" })).toBeNull();
  });

  it("gives each position link a distinct name", async () => {
    approved = true;
    render(<PortfolioView />);
    expect(await screen.findByRole("link", { name: "View pool WHEAT-2027" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View pool BARLEY-27" })).toBeInTheDocument();
  });

  it("announces loading through a status role", () => {
    render(<PortfolioView />);
    expect(screen.getByRole("status", { name: "Loading portfolio" })).toBeInTheDocument();
  });
});

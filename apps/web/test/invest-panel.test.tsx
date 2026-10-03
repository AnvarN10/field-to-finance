// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypair } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolView } from "../src/lib/chain/views";

const wallet = Keypair.generate().publicKey;
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({ publicKey: wallet, connected: true, sendTransaction: vi.fn() }),
  useConnection: () => ({ connection: {} }),
}));
vi.mock("../src/components/wallet/connect-button", () => ({ ConnectButton: () => <button type="button">Connect</button> }));

const { InvestPanel } = await import("../src/components/pool/invest-panel");

const POOL: PoolView = {
  address: "A", poolId: "7", issuer: "I", mint: "M", vault: "V", crop: "wheat", season: 2027,
  targetAmount: "2000000000", raisedAmount: "0", yieldBps: 800, premiumBps: 550,
  subscriptionCloseTs: Math.floor(Date.now() / 1000) + 600, maturityTs: Math.floor(Date.now() / 1000) + 1200,
  projectCount: 1, disbursedCount: 0, settledCount: 0, status: "Open",
  instrument: { name: "Wheat 2027", symbol: "WHEAT-2027", uri: "", supply: "0", decimals: 6 },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/investor/")) {
        return Response.json({ wallet: wallet.toBase58(), approved: false, approvedAt: null, usdcBalance: "1000000000", solLamports: 50_000_000, positions: [{ poolId: "7", pool: "A", symbol: "WHEAT-2027", status: "Open", yieldBps: 800, ata: "X", exists: false, frozen: true, balance: "0" }] });
      }
      if (url === "/api/tx/subscribe") {
        return Response.json({ ok: false, error: { code: "KycRequired", title: "This wallet hasn't passed KYC", detail: "Instrument accounts start frozen and only KYC-approved wallets can subscribe. Complete KYC, then subscribe again.", action: "kyc" }, logs: ["Program log: AnchorError caused by account: investor_record."] }, { status: 422 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});

describe("InvestPanel", () => {
  it("names KYC the same way everywhere: Not completed, with a Complete KYC action", async () => {
    render(<InvestPanel pool={POOL} />);
    expect(await screen.findByText("Not completed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete KYC" })).toBeInTheDocument();
  });

  it("shows the KYC rejection with a way out when an unapproved wallet subscribes", async () => {
    render(<InvestPanel pool={POOL} />);
    expect(await screen.findByText("Not completed")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "250");
    await userEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This wallet hasn't passed KYC");
    await userEvent.click(within(alert).getByRole("button", { name: "Complete KYC" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Complete KYC" })).toBeInTheDocument();
  });

  it("blocks an amount above the remaining capacity before calling the server", async () => {
    render(<InvestPanel pool={{ ...POOL, raisedAmount: "1999000000" }} />);
    await screen.findByText("Not completed");
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(screen.getByText("The pool needs at most $1.00 more")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([u]) => u === "/api/tx/subscribe")).toBe(false);
  });
});

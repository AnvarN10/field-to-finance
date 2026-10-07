// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypair } from "@solana/web3.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolView } from "../src/lib/chain/views";

const wallet = Keypair.generate().publicKey;
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
let subscribeError: unknown = null;
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: () => ({ publicKey: wallet, connected: true, signTransaction: vi.fn() }),
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
        if (subscribeError) return Response.json({ ok: false, error: subscribeError, logs: [] }, { status: 403 });
        return Response.json({ ok: false, error: { code: "KycRequired", title: "This wallet hasn't passed KYC", detail: "Instrument accounts start frozen and only KYC-approved wallets can subscribe. Complete KYC, then subscribe again.", action: "kyc" }, logs: ["Program log: AnchorError caused by account: investor_record."] }, { status: 422 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});

describe("InvestPanel", () => {
  it("uses an explicit signer (the investor's email wallet in the cabinet) instead of the adapter wallet", async () => {
    const other = Keypair.generate().publicKey.toBase58();
    render(<InvestPanel pool={POOL} networkFee="500000" signer={{ publicKey: other, sign: vi.fn() }} />);
    await screen.findByText("Not completed");
    expect(vi.mocked(fetch).mock.calls.some(([u]) => u === `/api/investor/${other}`)).toBe(true);
  });

  it("names KYC the same way everywhere: Not completed, with a Complete KYC link to investor onboarding", async () => {
    render(<InvestPanel pool={POOL} networkFee="500000" />);
    expect(await screen.findByText("Not completed")).toBeInTheDocument();
    const kyc = screen.getByRole("link", { name: "Complete KYC" });
    expect(kyc).toHaveAttribute("href", "/invest/account");
    const subscribe = screen.getByRole("button", { name: /^Subscribe/ });
    // The required first step comes before the subscribe form.
    expect(kyc.compareDocumentPosition(subscribe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the KYC rejection with a way out when an unapproved wallet subscribes", async () => {
    render(<InvestPanel pool={POOL} networkFee="500000" />);
    expect(await screen.findByText("Not completed")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "250");
    await userEvent.click(screen.getByRole("button", { name: /^Subscribe/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This wallet hasn't passed KYC");
    await userEvent.click(within(alert).getByRole("button", { name: "Complete KYC" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/invest/account"));
  });

  it("sends an onboarded investor to the pool's key features document when it is not accepted yet", async () => {
    subscribeError = { code: "KfdRequired", title: "Accept this pool's key features document", detail: "", action: "kfd" };
    try {
      render(<InvestPanel pool={POOL} networkFee="500000" />);
      expect(await screen.findByText("Not completed")).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText("Amount (USD)"), "250");
      await userEvent.click(screen.getByRole("button", { name: /^Subscribe/ }));
      const alert = await screen.findByRole("alert");
      await userEvent.click(within(alert).getByRole("button", { name: "Read the key features" }));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/invest/pools/7"));
    } finally {
      subscribeError = null;
    }
  });

  it("blocks an amount above the remaining capacity before calling the server", async () => {
    render(<InvestPanel pool={{ ...POOL, raisedAmount: "1999000000" }} networkFee="500000" />);
    await screen.findByText("Not completed");
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "5");
    await userEvent.click(screen.getByRole("button", { name: /^Subscribe/ }));
    expect(screen.getByText("The pool needs at most $1.00 more")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (USD)")).toHaveFocus();
    expect(vi.mocked(fetch).mock.calls.some(([u]) => u === "/api/tx/subscribe")).toBe(false);
  });

  it("discloses the network fee, the total and that no SOL is needed before signing", async () => {
    render(<InvestPanel pool={POOL} networkFee="500000" />);
    await screen.findByText("Not completed");
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "250");
    const summary = screen.getByRole("group", { name: "Payment summary" });
    expect(within(summary).getByText("Network fee").nextSibling).toHaveTextContent("$0.50");
    expect(within(summary).getByText("Total").nextSibling).toHaveTextContent("$250.50");
    expect(screen.getByText(/No SOL needed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe · $250.50" })).toBeInTheDocument();
  });

  it("shows no fee line when fees are not configured", async () => {
    render(<InvestPanel pool={POOL} networkFee={null} />);
    await screen.findByText("Not completed");
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "250");
    expect(screen.queryByText("Network fee")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe · $250.00" })).toBeInTheDocument();
  });

  it("stops a subscription the wallet cannot pay with the fee included", async () => {
    render(<InvestPanel pool={POOL} networkFee="500000" />);
    await screen.findByText("Not completed");
    await userEvent.type(screen.getByLabelText("Amount (USD)"), "1000");
    await userEvent.click(screen.getByRole("button", { name: /^Subscribe/ }));
    expect(screen.getByText("You need $1,000.50 in test USDC (amount plus $0.50 network fee); this wallet has $1,000.00")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([u]) => u === "/api/tx/subscribe")).toBe(false);
  });
});

describe("InvestPanel for an instrument sold in whole tokens", () => {
  const NOMINAL = 100_000_000_000n;
  const TOKENS_POOL: PoolView = {
    ...POOL,
    targetAmount: (10n * NOMINAL).toString(),
    terms: {
      unitNominal: NOMINAL.toString(), couponBpsAnnual: 500, dayCount: "Act360", startTs: POOL.maturityTs - 300 * 86_400, settlementMode: "Hybrid",
      volumeKg: "10000000", tokenizedShareBps: 3_000, qualitySpecHash: "ab".repeat(32), specUri: "", elevator: "Ust-Kamenogorsk", lab: "Baltic Control",
      election: null, electedAt: 0, receiptHash: null, labCertHash: null, labPassed: false, deliveredKg: "0",
    },
  };

  it("asks for tokens of $100,000 and totals them with the network fee", async () => {
    render(<InvestPanel pool={TOKENS_POOL} networkFee="500000" />);
    const input = await screen.findByLabelText("Tokens");
    await userEvent.clear(input);
    await userEvent.type(input, "2");
    const summary = screen.getByRole("group", { name: "Payment summary" });
    expect(within(summary).getByText("$200,000.00")).toBeInTheDocument();
    expect(within(summary).getByText("$200,000.50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe · $200,000.50" })).toBeInTheDocument();
    expect(screen.getByText(/1 token = \$100,000\.00/)).toBeInTheDocument();
  });

  it("refuses a fraction of a token before anything is sent", async () => {
    render(<InvestPanel pool={TOKENS_POOL} networkFee="500000" />);
    const input = await screen.findByLabelText("Tokens");
    await userEvent.clear(input);
    await userEvent.type(input, "1.5");
    await userEvent.click(screen.getByRole("button", { name: /Subscribe/ }));
    expect(await screen.findByText("Enter a whole number of tokens")).toBeInTheDocument();
  });
});

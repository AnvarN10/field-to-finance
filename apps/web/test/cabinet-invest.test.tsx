// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import type { PoolView } from "../src/lib/chain/views";

const phantom = Keypair.generate().publicKey;
const email = { publicKey: Keypair.generate().publicKey.toBase58(), sign: vi.fn() };
const panel = vi.fn();
vi.mock("@solana/wallet-adapter-react", () => ({ useWallet: () => ({ publicKey: phantom, connected: true }) }));
vi.mock("../src/components/auth/auth-context", () => ({ useAuth: () => ({ signer: email }) }));
vi.mock("../src/components/pool/invest-panel", () => ({
  InvestPanel: (p: { signer?: unknown }) => {
    panel(p.signer);
    return null;
  },
}));
const { CabinetInvest } = await import("../src/components/investor/cabinet-invest");
const POOL = { poolId: "7" } as PoolView;

describe("cabinet invest signer", () => {
  it("pays from the email wallet when the connected Phantom belongs to another account", () => {
    render(<CabinetInvest pool={POOL} networkFee={null} linkedWallets={[email.publicKey]} />);
    expect(panel).toHaveBeenLastCalledWith(email);
    expect(screen.getByText(/is not linked to this account, so your email wallet pays/)).toBeTruthy();
  });

  it("lets the connected Phantom sign when it is linked to this account", () => {
    render(<CabinetInvest pool={POOL} networkFee={null} linkedWallets={[phantom.toBase58()]} />);
    expect(panel).toHaveBeenLastCalledWith(undefined);
    expect(screen.queryByText(/is not linked/)).toBeNull();
  });
});

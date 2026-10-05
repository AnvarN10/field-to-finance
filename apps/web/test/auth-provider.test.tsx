// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/public-env", () => ({ publicEnv: { NEXT_PUBLIC_PRIVY_APP_ID: "app", NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.devnet.solana.com" } }));
vi.mock("../src/components/auth/privy-auth", () => new Promise(() => {}));
const { AuthProvider } = await import("../src/components/auth/auth-provider");
const { useAuth } = await import("../src/components/auth/auth-context");

function Probe() {
  const a = useAuth();
  return <p>{a.ready ? "ready" : "auth loading"}</p>;
}

describe("AuthProvider", () => {
  it("renders the cabinet content at once while Privy's bundle loads", () => {
    render(
      <AuthProvider>
        <h1>Cabinet</h1>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByRole("heading", { name: "Cabinet" })).toBeInTheDocument();
    expect(screen.getByText("auth loading")).toBeInTheDocument();
  });
});

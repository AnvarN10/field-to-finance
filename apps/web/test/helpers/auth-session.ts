import { vi } from "vitest";
import type { AuthSession } from "../../src/components/auth/auth-context";

/** A Privy auth context for component tests; override what the test needs. */
export const authSession = (over: Partial<AuthSession> = {}): AuthSession => ({
  mode: "privy",
  ready: true,
  authenticated: false,
  email: null,
  signer: null,
  embeddedWallet: null,
  server: { state: "idle" },
  login: vi.fn(),
  logout: vi.fn(async () => {}),
  resync: vi.fn(async () => {}),
  ...over,
});

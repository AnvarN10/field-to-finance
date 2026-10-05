// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthSession } from "../src/components/auth/auth-context";
import { cabinetFor, safeNext } from "../src/lib/auth/redirects";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const chooseRoleAction = vi.fn(async () => ({ ok: true as const, roles: ["investor"] as const }));
vi.mock("../src/app/sign-in/actions", () => ({ chooseRoleAction: (...a: unknown[]) => chooseRoleAction(...(a as [])) }));
const { SignInPanel } = await import("../src/app/sign-in/sign-in-panel");

const session = (over: Partial<AuthSession>): AuthSession => ({
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
const mount = (s: AuthSession, next: string | null = null) =>
  render(
    <AuthContext.Provider value={s}>
      <SignInPanel next={next} />
    </AuthContext.Provider>,
  );

describe("safeNext and cabinetFor", () => {
  it("keeps same-origin paths only", () => {
    expect(safeNext("/arranger/roles")).toBe("/arranger/roles");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
  it("sends arrangers to the arranger cabinet first", () => {
    expect(cabinetFor(["farmer", "arranger"])).toBe("/arranger");
    expect(cabinetFor(["investor"])).toBe("/investor");
    expect(cabinetFor([])).toBeNull();
  });
});

describe("SignInPanel", () => {
  it("offers one email sign-in button when signed out", async () => {
    const login = vi.fn();
    mount(session({ login }));
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(login).toHaveBeenCalled();
  });

  it("asks a new account to choose farmer or investor, then opens that cabinet", async () => {
    mount(session({ authenticated: true, email: "a@example.com", server: { state: "ready", roles: [] } }));
    expect(screen.getByRole("button", { name: /I am a farmer/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /I am an investor/ }));
    expect(chooseRoleAction).toHaveBeenCalledWith("investor");
    expect(replace).toHaveBeenCalledWith("/investor");
  });

  it("goes to a safe next path once the server session has roles, and ignores an unsafe one", () => {
    replace.mockClear();
    const a = mount(session({ authenticated: true, server: { state: "ready", roles: ["arranger"] } }), "/arranger/roles");
    expect(replace).toHaveBeenCalledWith("/arranger/roles");
    a.unmount();
    mount(session({ authenticated: true, server: { state: "ready", roles: ["arranger"] } }), "//evil.example");
    expect(replace).toHaveBeenLastCalledWith("/arranger");
  });

  it("shows the server error with a way to retry", async () => {
    const resync = vi.fn(async () => {});
    mount(session({ authenticated: true, server: { state: "error", message: "Accounts are unavailable right now. Try again in a minute." }, resync }));
    expect(screen.getByRole("alert")).toHaveTextContent("Accounts are unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(resync).toHaveBeenCalled();
  });

  it("explains when sign-in is not configured", () => {
    mount(session({ mode: "unconfigured" }));
    expect(screen.getByText(/Sign-in is not configured/)).toBeInTheDocument();
  });
});

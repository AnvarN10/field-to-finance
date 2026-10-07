// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthSession } from "../src/components/auth/auth-context";
import { safeNext } from "../src/lib/auth/redirects";
import { authSession as session } from "./helpers/auth-session";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
const { SignInPanel } = await import("../src/app/(site)/sign-in/sign-in-panel");

const mount = (s: AuthSession, next: string | null = null) =>
  render(
    <AuthContext.Provider value={s}>
      <SignInPanel next={next} />
    </AuthContext.Provider>,
  );

describe("safeNext", () => {
  it("keeps same-origin paths only", () => {
    expect(safeNext("/console/team")).toBe("/console/team");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});

describe("SignInPanel", () => {
  it("offers one email sign-in button when signed out, plus the two doors", async () => {
    const login = vi.fn();
    mount(session({ login }));
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(login).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Start investing" })).toHaveAttribute("href", "/invest/signup");
    expect(screen.getByRole("link", { name: "Apply for financing" })).toHaveAttribute("href", "/apply");
  });

  it("never asks a signed-in account to pick a role: no account means the two doors", () => {
    mount(session({ authenticated: true, email: "new@example.com", server: { state: "ready", roles: [] } }));
    expect(screen.queryByText(/I am a/)).toBeNull();
    expect(screen.getByRole("heading", { name: "No account for this email yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start investing" })).toHaveAttribute("href", "/invest/signup");
    expect(screen.getByRole("link", { name: "Apply for financing" })).toHaveAttribute("href", "/apply");
    expect(screen.getByRole("button", { name: "Use another email" })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends each account home: console, issuer workspace, investor app", () => {
    for (const [roles, home] of [[["regulator", "investor"], "/console"], [["farmer"], "/issuer"], [["investor"], "/invest"]] as const) {
      replace.mockClear();
      const v = mount(session({ authenticated: true, server: { state: "ready", roles: [...roles] } }));
      expect(replace).toHaveBeenCalledWith(home);
      v.unmount();
    }
  });

  it("goes to a safe next path, and ignores an unsafe one", () => {
    replace.mockClear();
    const a = mount(session({ authenticated: true, server: { state: "ready", roles: ["arranger"] } }), "/console/team");
    expect(replace).toHaveBeenCalledWith("/console/team");
    a.unmount();
    mount(session({ authenticated: true, server: { state: "ready", roles: ["arranger"] } }), "//evil.example");
    expect(replace).toHaveBeenLastCalledWith("/console");
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

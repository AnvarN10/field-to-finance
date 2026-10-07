// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthSession } from "../src/components/auth/auth-context";
import { authSession } from "./helpers/auth-session";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
let result: { ok: true; home: string } | { ok: false; error: string; home: string | null } = { ok: true, home: "/invest/account" };
const openAccountAction = vi.fn(async () => result);
vi.mock("../src/app/(site)/doors-actions", () => ({ openAccountAction: (...a: unknown[]) => openAccountAction(...(a as [])) }));
const { DoorSignup } = await import("../src/components/doors/door-signup");

const mount = (s: AuthSession, door: "investor" | "issuer" = "investor") =>
  render(
    <AuthContext.Provider value={s}>
      <DoorSignup door={door} />
    </AuthContext.Provider>,
  );

describe("DoorSignup", () => {
  it("starts with one email sign-up button and no role choice", () => {
    mount(authSession());
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeInTheDocument();
    expect(screen.queryByText(/I am a/)).toBeNull();
  });

  it("opens the door's account right after sign-in and goes on", async () => {
    result = { ok: true, home: "/invest/account" };
    mount(authSession({ authenticated: true, email: "i@example.com", server: { state: "ready", roles: [] } }));
    await waitFor(() => expect(openAccountAction).toHaveBeenCalledWith("investor"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/invest/account"));
  });

  it("explains the other door's account and links home", async () => {
    result = { ok: false, error: "This email already has an issuer account. Use another email for an investor account.", home: "/issuer" };
    mount(authSession({ authenticated: true, email: "f@example.com", server: { state: "ready", roles: ["farmer"] } }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already has an issuer account");
    expect(screen.getByRole("link", { name: "Go to your issuer workspace" })).toHaveAttribute("href", "/issuer");
    expect(screen.getByRole("button", { name: "Use another email" })).toBeInTheDocument();
  });

  it("asks a signed-in console member before opening an account", async () => {
    openAccountAction.mockClear();
    result = { ok: true, home: "/invest/account" };
    mount(authSession({ authenticated: true, email: "co@example.com", server: { state: "ready", roles: ["compliance"] } }));
    const yes = await screen.findByRole("button", { name: "Open investor account" });
    expect(openAccountAction).not.toHaveBeenCalled();
    fireEvent.click(yes);
    await waitFor(() => expect(openAccountAction).toHaveBeenCalledWith("investor"));
  });
});

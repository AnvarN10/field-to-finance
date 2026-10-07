// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthSession } from "../src/components/auth/auth-context";
import { authSession } from "./helpers/auth-session";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
let result: { ok: true } | { ok: false; error: string } = { ok: true };
const acceptInvitationAction = vi.fn(async () => result);
vi.mock("../src/app/(site)/invite/[token]/actions", () => ({ acceptInvitationAction: (...a: unknown[]) => acceptInvitationAction(...(a as [])) }));
const { AcceptInvitation } = await import("../src/app/(site)/invite/[token]/accept");

const mount = (s: AuthSession) =>
  render(
    <AuthContext.Provider value={s}>
      <AcceptInvitation token="tok" maskedEmail="p***@example.com" />
    </AuthContext.Provider>,
  );

describe("AcceptInvitation", () => {
  it("asks a signed-out visitor to sign in with the invited email", async () => {
    const login = vi.fn();
    mount(authSession({ login }));
    expect(screen.getByText(/p\*\*\*@example\.com/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    expect(login).toHaveBeenCalled();
  });

  it("accepts once signed in and opens the console", async () => {
    result = { ok: true };
    mount(authSession({ authenticated: true, email: "p@example.com", server: { state: "ready", roles: [] } }));
    await userEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    expect(acceptInvitationAction).toHaveBeenCalledWith("tok");
    expect(replace).toHaveBeenCalledWith("/console");
  });

  it("explains a wrong email and offers another sign-in", async () => {
    result = { ok: false, error: "This invitation is for another email." };
    const logout = vi.fn(async () => {});
    mount(authSession({ authenticated: true, email: "other@example.com", server: { state: "ready", roles: ["investor"] }, logout }));
    await userEvent.click(screen.getByRole("button", { name: "Accept invitation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This invitation is for another email.");
    await userEvent.click(screen.getByRole("button", { name: "Use another email" }));
    expect(logout).toHaveBeenCalled();
  });
});

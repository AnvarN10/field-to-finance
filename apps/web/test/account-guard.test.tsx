// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let user: unknown = null;
vi.mock("@/lib/server/auth", () => ({
  signedInUser: async (next: string) => {
    if (user instanceof Error) throw user;
    if (!user) throw new Error(`NEXT_REDIRECT /sign-in?next=${encodeURIComponent(next)}`);
    return user;
  },
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: (e: unknown) => { if (String((e as Error).message).startsWith("NEXT_REDIRECT")) throw e; }, useRouter: () => ({}) }));
const { guardAccount } = await import("../src/components/shell/account-guard");

describe("guardAccount", () => {
  it("returns the user with the account kind", async () => {
    user = { id: "1", email: "i@example.com", roles: ["investor"] };
    expect(await guardAccount("investor", "/invest")).toEqual({ user });
  });

  it("redirects a signed-out visitor to sign-in", async () => {
    user = null;
    await expect(guardAccount("investor", "/invest/portfolio")).rejects.toThrow("NEXT_REDIRECT /sign-in?next=%2Finvest%2Fportfolio");
  });

  it("points an account without an investor account to the sign-up door and its own app", async () => {
    user = { id: "1", email: "f@example.com", roles: ["farmer"] };
    const g = await guardAccount("investor", "/invest");
    render((g as { element: React.ReactElement }).element);
    expect(screen.getByRole("heading", { name: "This app is for investors" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your issuer workspace" })).toHaveAttribute("href", "/issuer");
  });

  it("offers the matching door when the account has no app yet", async () => {
    user = { id: "1", email: "n@example.com", roles: [] };
    const g = await guardAccount("farmer", "/issuer");
    render((g as { element: React.ReactElement }).element);
    expect(screen.getByRole("link", { name: "Apply for financing" })).toHaveAttribute("href", "/apply");
  });

  it("shows an error state when accounts cannot be loaded", async () => {
    user = new Error("down");
    const g = await guardAccount("investor", "/invest");
    render((g as { element: React.ReactElement }).element);
    expect(screen.getByRole("alert")).toHaveTextContent("Your account is unavailable");
  });
});

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
vi.mock("next/navigation", () => ({ unstable_rethrow: (e: unknown) => { if (String((e as Error).message).startsWith("NEXT_REDIRECT")) throw e; }, usePathname: () => "/", useRouter: () => ({}) }));
const { guardConsole } = await import("../src/components/console/guard");

describe("guardConsole", () => {
  it("returns the user and permissions when the permission is held", async () => {
    user = { id: "1", email: "s@example.com", roles: ["scas"] };
    const g = await guardConsole("verification.attest", "/console/verification");
    expect("user" in g && [...g.permissions]).toEqual(["verification.attest"]);
  });

  it("accepts any of several permissions; null means any console member", async () => {
    user = { id: "1", email: "l@example.com", roles: ["lab"] };
    expect("user" in (await guardConsole(["delivery.receipt", "delivery.lab"], "/console/delivery"))).toBe(true);
    expect("user" in (await guardConsole(null, "/console"))).toBe(true);
  });

  it("sends a signed-out visitor to sign-in", async () => {
    user = null;
    await expect(guardConsole("audit.view", "/console/audit")).rejects.toThrow("NEXT_REDIRECT /sign-in?next=%2Fconsole%2Faudit");
  });

  it("tells a non-member the console is invitation only and links to their own app", async () => {
    user = { id: "1", email: "i@example.com", roles: ["investor"] };
    const g = await guardConsole(null, "/console");
    render((g as { element: React.ReactElement }).element);
    expect(screen.getByRole("heading", { name: "The console is for invited team members" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your investor app" })).toHaveAttribute("href", "/invest");
  });

  it("explains a missing permission to a member", async () => {
    user = { id: "1", email: "r@example.com", roles: ["regulator"] };
    const g = await guardConsole("audit.view", "/console/audit");
    render((g as { element: React.ReactElement }).element);
    expect(screen.getByRole("heading", { name: "You do not have access to this section" })).toBeInTheDocument();
    expect(screen.getByText(/view the audit log/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the inbox" })).toHaveAttribute("href", "/console");
  });

  it("shows an error state when accounts cannot be loaded", async () => {
    user = new Error("connect ECONNREFUSED");
    const g = await guardConsole("audit.view", "/console/audit");
    render((g as { element: React.ReactElement }).element);
    expect(screen.getByRole("alert")).toHaveTextContent("The console is unavailable");
  });
});

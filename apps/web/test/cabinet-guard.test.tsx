// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let outcome: unknown = null;
vi.mock("@/lib/server/auth", () => ({
  requireRole: async () => {
    if (outcome instanceof Error) throw outcome;
    return outcome;
  },
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: (e: unknown) => { if ((e as Error).message === "NEXT_REDIRECT") throw e; }, usePathname: () => "/", useRouter: () => ({}) }));
const { guardCabinet } = await import("../src/components/cabinet/guard");

describe("guardCabinet", () => {
  it("returns the user when the role is held", async () => {
    outcome = { forbidden: false, user: { id: "1", email: "a@example.com", roles: ["farmer"] } };
    expect(await guardCabinet("farmer", "/farmer")).toEqual({ user: { id: "1", email: "a@example.com", roles: ["farmer"] } });
  });

  it("renders the 403 state with a link to the user's own cabinet", async () => {
    outcome = { forbidden: true, user: { id: "1", email: "a@example.com", roles: ["investor"] } };
    const r = await guardCabinet("farmer", "/farmer");
    render((r as { element: React.ReactElement }).element);
    expect(screen.getByRole("link", { name: "Go to your cabinet" })).toHaveAttribute("href", "/investor");
  });

  it("renders an error state when Postgres is unavailable", async () => {
    outcome = new Error("connect ECONNREFUSED");
    const r = await guardCabinet("farmer", "/farmer");
    render((r as { element: React.ReactElement }).element);
    expect(screen.getByRole("alert")).toHaveTextContent("Your cabinet is unavailable");
  });

  it("lets the sign-in redirect through", async () => {
    outcome = new Error("NEXT_REDIRECT");
    await expect(guardCabinet("farmer", "/farmer")).rejects.toThrow("NEXT_REDIRECT");
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/pools" }));
const { SiteHeader } = await import("../src/components/site-header");

const session = (body: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body)));
afterEach(() => vi.restoreAllMocks());

describe("SiteHeader", () => {
  it("offers the two doors and sign-in, never the cabinets", async () => {
    session({ signedIn: false, home: null });
    render(<SiteHeader />);
    expect(screen.getAllByRole("link", { name: "Start investing" })[0]).toHaveAttribute("href", "/invest/signup");
    expect(screen.getAllByRole("link", { name: "Get financing" })[0]).toHaveAttribute("href", "/apply");
    expect(screen.getAllByRole("link", { name: "Sign in" })[0]).toHaveAttribute("href", "/sign-in");
    for (const name of ["Investor", "Farmer", "Arranger"]) expect(screen.queryByRole("link", { name })).toBeNull();
  });

  it("swaps sign-in and sign-up for one link to the user's app when a session exists", async () => {
    session({ signedIn: true, home: "/console" });
    render(<SiteHeader />);
    expect(await screen.findByRole("link", { name: "Open app" })).toHaveAttribute("href", "/console");
    expect(screen.queryByRole("link", { name: "Start investing" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});

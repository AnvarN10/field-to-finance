// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { permissionsOf } from "../src/lib/permissions";

let path = "/console/pools/8";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
const { ConsoleNav } = await import("../src/components/console/console-nav");
const { navFor } = await import("../src/components/console/nav-items");

const labels = (roles: Parameters<typeof permissionsOf>[0]) => navFor(permissionsOf(roles)).map((i) => i.label);

describe("console navigation", () => {
  it("shows each role only the sections its permissions open", () => {
    expect(labels(["regulator"])).toEqual(["Inbox", "Registry"]);
    expect(labels(["elevator", "lab"])).toEqual(["Inbox", "Delivery"]);
    expect(labels(["scas"])).toEqual(["Inbox", "Verification"]);
    expect(labels(["compliance"])).toEqual(["Inbox", "Issuers", "Investors"]);
    expect(labels(["arranger"])).toEqual(["Inbox", "Applications", "Issuers", "Investors", "Pools", "Settlement", "Verification", "Delivery", "Registry", "Audit", "Team", "Settings"]);
  });

  it("marks the section of the current page; Inbox only on /console itself", () => {
    render(<ConsoleNav items={navFor(permissionsOf(["arranger"]))} />);
    const nav = screen.getByRole("navigation", { name: "Console" });
    expect(within(nav).getByRole("link", { name: "Pools" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Inbox" })).not.toHaveAttribute("aria-current");
  });
});

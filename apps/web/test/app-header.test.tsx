// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

let path = "/invest/portfolio";
vi.mock("next/navigation", () => ({ usePathname: () => path, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../src/components/cabinet/notification-bell", () => ({ NotificationBell: () => <span data-testid="bell" /> }));
const { AppHeader } = await import("../src/components/shell/app-header");
const { INVEST_TABS } = await import("../src/components/shell/tabs");

describe("AppHeader", () => {
  it("marks the current tab; the overview is active only on its own path", () => {
    render(<AppHeader home="/invest" label="Investor app" tabs={INVEST_TABS} email="i@example.com" roles={["investor"]} />);
    const nav = screen.getAllByRole("navigation", { name: "Investor app" })[0]!;
    expect(within(nav).getByRole("link", { name: "Portfolio" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("bell")).toBeInTheDocument();
  });

  it("lists the other apps only when the account has them, plus sign out", async () => {
    path = "/invest";
    render(<AppHeader home="/invest" label="Investor app" tabs={INVEST_TABS} email="i@example.com" roles={["investor", "regulator"]} />);
    await userEvent.click(screen.getByRole("button", { name: /Account/ }));
    const menu = screen.getByRole("region", { name: "Account" });
    expect(within(menu).getByText("i@example.com")).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Console" })).toHaveAttribute("href", "/console");
    expect(within(menu).queryByRole("link", { name: "Issuer workspace" })).toBeNull();
    expect(within(menu).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let pathname = "/arranger/roles";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
const { CabinetNav } = await import("../src/components/cabinet/cabinet-nav");
const { NoAccess } = await import("../src/components/cabinet/no-access");
const { StatusTimeline } = await import("../src/components/cabinet/status-timeline");

describe("CabinetNav", () => {
  it("marks the current tab, and the overview only on its own path", () => {
    render(<CabinetNav tabs={[{ href: "/arranger", label: "Pipeline" }, { href: "/arranger/roles", label: "Roles" }]} />);
    expect(screen.getByRole("link", { name: "Roles" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Pipeline" })).not.toHaveAttribute("aria-current");
  });
});

describe("NoAccess", () => {
  it("names the missing role and the email to grant it to", () => {
    render(<NoAccess role="arranger" email="inv@example.com" otherCabinet="/investor" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This cabinet is for arrangers");
    expect(screen.getByText(/Ask an arranger to grant the arranger role to inv@example.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your cabinet" })).toHaveAttribute("href", "/investor");
  });
});

describe("StatusTimeline", () => {
  it("states done, current and upcoming in text, not colour alone, with owner and next action", () => {
    render(<StatusTimeline status="kyc" />);
    expect(screen.getByText("Issuer KYC")).toBeInTheDocument();
    expect(screen.getByText(/Next: Decide the issuer's KYC/)).toBeInTheDocument();
    expect(screen.getByText(/Arranger/)).toBeInTheDocument();
    expect(screen.getAllByText("Done", { selector: ".sr-only" }).length).toBe(3);
    expect(screen.getByText("Current step", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("shows rejected and withdrawn applications as stopped, with the reason", () => {
    render(<StatusTimeline status="rejected" note="Fields outside the region" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Fields outside the region")).toBeInTheDocument();
  });
});

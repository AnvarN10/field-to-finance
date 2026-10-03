// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExplorerLink } from "../src/components/explorer-link";
import { SCAS_STUB_LABEL, ScasStubBadge } from "../src/components/scas-stub-badge";
import { EmptyState, ErrorState } from "../src/components/state";
import { PoolStatusBadge } from "../src/components/status-badge";

describe("shared components", () => {
  it("links a transaction to the devnet explorer in a new tab", () => {
    render(<ExplorerLink kind="tx" value="5sig" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://explorer.solana.com/tx/5sig?cluster=devnet");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shortens addresses in mono", () => {
    render(<ExplorerLink kind="address" value="9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm" />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("9syr…6Jfm");
    expect(link.className).toContain("font-mono");
  });

  it("shows the stub badge text without em dashes", () => {
    render(<ScasStubBadge />);
    expect(screen.getByText(SCAS_STUB_LABEL)).toBeInTheDocument();
    expect(SCAS_STUB_LABEL).toBe("Verified by SCAS stub: external provider pending");
    expect(SCAS_STUB_LABEL).not.toContain("—");
  });

  it("labels every pool status", () => {
    const labels = { Draft: "Draft", Open: "Open for subscription", Funded: "Funded", Refunding: "Refunding", Redeeming: "Redeeming" };
    for (const [status, label] of Object.entries(labels)) {
      const { unmount } = render(<PoolStatusBadge status={status as keyof typeof labels} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders empty and error states with a way out", () => {
    render(<EmptyState title="No pools yet" body="Pools appear here once the Issuer opens one." />);
    expect(screen.getByRole("heading", { name: "No pools yet" })).toBeInTheDocument();
    render(<ErrorState title="Could not load pools" body="Devnet did not answer." retryHref="/pools" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/pools");
  });
});

describe("SkipLink", () => {
  it("is the first stop for keyboard users and targets the main landmark", async () => {
    const { SkipLink, MAIN_ID } = await import("../src/components/skip-link");
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveAttribute("href", `#${MAIN_ID}`);
    expect(link.className).toContain("sr-only");
    expect(link.className).toContain("focus:not-sr-only");
  });
});

describe("page-level states", () => {
  it("render the title as the page h1 when level is 1", () => {
    render(<ErrorState level={1} title="Pool not found" body="b" />);
    expect(screen.getByRole("heading", { level: 1, name: "Pool not found" })).toBeInTheDocument();
    render(<EmptyState level={1} title="No pools yet" body="b" />);
    expect(screen.getByRole("heading", { level: 1, name: "No pools yet" })).toBeInTheDocument();
  });
});

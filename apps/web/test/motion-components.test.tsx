// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FundingMeter } from "../src/components/pool/funding-meter";
import { TxStatus } from "../src/components/tx/tx-status";

describe("FundingMeter", () => {
  it("positions the fill with a transform, so only the mount animates and later values jump", () => {
    const { container } = render(<FundingMeter raised="250000000" target="1000000000" />);
    const fill = container.querySelector<HTMLElement>("[data-slot=meter-fill]")!;
    expect(fill).toHaveClass("meter-fill");
    expect(fill.style.translate).toBe("-75% 0");
    expect(fill.style.width).toBe("");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "25");
  });

  it("caps the fill at a full track", () => {
    const { container } = render(<FundingMeter raised="2000" target="1000" />);
    expect(container.querySelector<HTMLElement>("[data-slot=meter-fill]")!.style.translate).toBe("0% 0");
  });
});

describe("TxStatus success", () => {
  it("draws the check, then shows the explorer link", () => {
    const { container } = render(<TxStatus state={{ phase: "success", signature: "5sig" }} />);
    const check = container.querySelector("[data-slot=drawn-check]")!;
    expect(check.querySelector(".check-draw-circle")).not.toBeNull();
    expect(check.querySelector(".check-draw-tick")).not.toBeNull();
    expect(screen.getByRole("link").closest(".tx-link-in")).not.toBeNull();
  });
});

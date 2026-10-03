// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ENTER_WINDOW_MS, useEnterOnce } from "../src/components/use-enter-once";

afterEach(() => vi.useRealTimers());

describe("useEnterOnce", () => {
  it("staggers rows of the first data load, then stops animating for good", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ ready }) => useEnterOnce(ready), { initialProps: { ready: true } });
    expect(result.current(0)).toEqual({ className: "enter-row", style: { animationDelay: "0ms" } });
    expect(result.current(3).style).toEqual({ animationDelay: "120ms" });
    act(() => vi.advanceTimersByTime(ENTER_WINDOW_MS));
    expect(result.current(0)).toEqual({ className: "" });
    // A refetch that adds rows renders them in place.
    rerender({ ready: true });
    expect(result.current(5)).toEqual({ className: "" });
  });
});

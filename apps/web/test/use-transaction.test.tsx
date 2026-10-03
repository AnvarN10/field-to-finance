// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const executeTx = vi.fn();
vi.mock("../src/lib/tx-client", () => ({ executeTx: (...a: unknown[]) => executeTx(...a), postJson: vi.fn() }));
const { useTransaction } = await import("../src/components/tx/use-transaction");

describe("useTransaction retry", () => {
  it("re-runs the last request body, so Try again is a working recovery", async () => {
    executeTx
      .mockResolvedValueOnce({ phase: "error", error: { code: "Unknown", title: "t", detail: "", action: "retry" }, logs: [] })
      .mockResolvedValueOnce({ phase: "success", signature: "5sig" });
    const signer = { publicKey: "W" } as never;
    const { result } = renderHook(() => useTransaction("subscribe", signer));
    await act(async () => void (await result.current.run({ poolId: "1", amount: "5" })));
    expect(result.current.state.phase).toBe("error");
    await act(async () => void (await result.current.retry()));
    expect(executeTx).toHaveBeenCalledTimes(2);
    expect(executeTx.mock.calls[1]?.[2]).toEqual({ poolId: "1", amount: "5" });
    expect(result.current.state.phase).toBe("success");
  });
});

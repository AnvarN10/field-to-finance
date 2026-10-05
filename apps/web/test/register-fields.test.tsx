// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const run = vi.fn();
let onSuccess: ((p: { signature: string; meta?: Record<string, string> }) => void) | undefined;
vi.mock("../src/components/tx/use-transaction", () => ({
  useTransaction: (_a: string, _s: unknown, opts: { onSuccess?: typeof onSuccess }) => {
    onSuccess = opts.onSuccess;
    return { state: { phase: "idle" }, busy: false, run, retry: vi.fn(), reset: vi.fn() };
  },
}));
vi.mock("../src/components/use-json", () => ({ useJson: () => ({ data: { usdcBalance: "10000000" }, error: null, loading: false, reload: vi.fn() }) }));
vi.mock("../src/components/field/field-map-loader", () => ({ FieldMapLoader: () => null }));
let uploaded: unknown[] = [];
vi.mock("../src/components/farmer/geojson-upload", () => ({
  GeojsonUpload: ({ onUploaded }: { onUploaded: (f: unknown[]) => void }) => (
    <button type="button" onClick={() => onUploaded(uploaded)}>
      fake upload
    </button>
  ),
}));
const { RegisterFields } = await import("../src/components/farmer/register-fields");

const signer = { publicKey: "FarmerWa11et1111111111111111111111111111111", sign: vi.fn() };
const app = { crop: "wheat", season: 2027, volumeT: 1000, requestedUsd: 200000 };

describe("RegisterFields", () => {
  it("asks for boundaries before registering", async () => {
    render(<RegisterFields signer={signer} application={app} mintFee={null} maxArrangementBps={null} onRegistered={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Register fields" }));
    expect(screen.getByText("Upload your field boundaries first.")).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it("registers with the application's crop, season, volume and amount, then reports the project", async () => {
    uploaded = [{ name: "Demo field A", polygonHash: "a".repeat(64), areaHa: 56.01, areaHaX100: 5601, polygon: { coordinates: [] }, declaredHa: "56.01" }];
    const onRegistered = vi.fn();
    render(<RegisterFields signer={signer} application={app} mintFee={null} maxArrangementBps={null} onRegistered={onRegistered} />);
    await userEvent.click(screen.getByRole("button", { name: "fake upload" }));
    await userEvent.click(screen.getByRole("button", { name: "Register fields" }));
    expect(run).toHaveBeenCalledWith({ crop: "wheat", season: 2027, expectedKg: "1000000", requestedAmount: "200000000000", fields: [{ polygonHash: "a".repeat(64), areaHaX100: 5601 }] });
    onSuccess?.({ signature: "s", meta: { project: "Proj111" } });
    expect(onRegistered).toHaveBeenCalledWith("Proj111", [expect.objectContaining({ polygonHash: "a".repeat(64), declaredAreaHa: 56.01 })]);
  });
});

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import type { AttestResult } from "../src/attest";
import { buildCli, type CliRuntime } from "../src/cli";
import { SQUARE } from "./helpers";

const PROJECT = Keypair.generate().publicKey.toBase58();

function runtime(): CliRuntime & { out: string[] } {
  const out: string[] = [];
  return {
    out,
    attest: vi.fn(async () => ({ verdict: "Pass" }) as unknown as AttestResult),
    putPolygon: vi.fn(async () => ({ polygonHash: "ab", areaHa: 1, areaHaX100: 100, key: "polygons/ab.json" })),
    stats: vi.fn(async () => ({ data: [] })),
    serve: vi.fn(async () => {}),
    print: (t) => out.push(t),
    printError: () => {},
  };
}

const argv = (...args: string[]) => ["node", "scas", ...args];

describe("scas CLI", () => {
  it("attest parses project, field, kind and replay date", async () => {
    const rt = runtime();
    await buildCli(rt).parseAsync(
      argv("attest", "--project", PROJECT, "--field", "1", "--kind", "vegetation", "--replay-date", "2026-07-12"),
    );
    const req = vi.mocked(rt.attest).mock.calls[0]?.[0];
    expect(req?.project.toBase58()).toBe(PROJECT);
    expect(req).toMatchObject({ fieldIndex: 1, kind: "Vegetation", replayDate: "2026-07-12", dryRun: false });
    expect(rt.out[0]).toContain('"verdict": "Pass"');
  });

  it("attest reads a polygon file and honors --dry-run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scas-"));
    const file = join(dir, "field.geojson");
    writeFileSync(file, JSON.stringify(SQUARE));
    const rt = runtime();
    await buildCli(rt).parseAsync(argv("attest", "--project", PROJECT, "--field", "0", "--kind", "FieldVerified", "--polygon", file, "--dry-run"));
    expect(vi.mocked(rt.attest).mock.calls[0]?.[0]).toMatchObject({ polygon: SQUARE, dryRun: true });
  });

  it("rejects an unknown kind and a field index out of range", async () => {
    const rt = runtime();
    await expect(buildCli(rt).parseAsync(argv("attest", "--project", PROJECT, "--field", "0", "--kind", "rain"))).rejects.toThrow();
    await expect(buildCli(rt).parseAsync(argv("attest", "--project", PROJECT, "--field", "256", "--kind", "Sowing"))).rejects.toThrow();
    expect(rt.attest).not.toHaveBeenCalled();
  });

  it("polygon put uploads a file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scas-"));
    const file = join(dir, "field.geojson");
    writeFileSync(file, JSON.stringify(SQUARE));
    const rt = runtime();
    await buildCli(rt).parseAsync(argv("polygon", "put", file));
    expect(rt.putPolygon).toHaveBeenCalledWith(SQUARE);
  });

  it("stats passes the window to the runtime", async () => {
    const dir = mkdtempSync(join(tmpdir(), "scas-"));
    const file = join(dir, "field.geojson");
    writeFileSync(file, JSON.stringify(SQUARE));
    const rt = runtime();
    await buildCli(rt).parseAsync(argv("stats", file, "--to", "2026-09-30", "--days", "30"));
    expect(rt.stats).toHaveBeenCalledWith(SQUARE, new Date("2026-09-30T12:00:00Z"), 30);
  });
});

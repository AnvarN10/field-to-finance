import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_FIELDS } from "../src/lib/demo/fields";
import { ACTOR_LAMPORTS, DEMO_ARRANGEMENT_BPS, DEMO_PRODUCER_USDC, demoSchedule, roleTopUp, sceneLine } from "../src/lib/demo/main-flow";
import { splitFeatures } from "../src/lib/geojson";

describe("demo flow helpers", () => {
  it("keeps maturity a few minutes out and after the close", () => {
    const s = demoSchedule();
    expect(s.maturityInMinutes).toBeGreaterThan(s.closeInMinutes);
    expect(s.maturityInMinutes).toBeLessThanOrEqual(10);
  });

  it("formats a scene line for the video script", () => {
    expect(sceneLine(3, "Issuer opens WHEAT-2027", "https://explorer.solana.com/tx/x?cluster=devnet")).toBe(
      "Scene 3: Issuer opens WHEAT-2027\n         https://explorer.solana.com/tx/x?cluster=devnet",
    );
    expect(sceneLine(1, "Start")).toBe("Scene 1: Start");
  });

  it("ships two valid demo fields", () => {
    expect(DEMO_FIELDS).toHaveLength(2);
    for (const f of DEMO_FIELDS) expect(splitFeatures(f.geojson)).toHaveLength(1);
  });

  it("uses exactly the boundaries of public/samples/demo-fields.geojson", () => {
    const file = JSON.parse(readFileSync(join(__dirname, "../public/samples/demo-fields.geojson"), "utf8")) as { features: object[] };
    expect(DEMO_FIELDS.map((f) => f.geojson)).toEqual(file.features);
  });

  it("tops a role key up to 0.3 SOL only when it is below 0.2 SOL", () => {
    expect(roleTopUp(290_000_000)).toBe(0);
    expect(roleTopUp(200_000_000)).toBe(0);
    expect(roleTopUp(150_000_000)).toBe(150_000_000);
    expect(roleTopUp(0)).toBe(300_000_000);
  });

  it("gives fresh actors no SOL: the gas sponsor pays fees and rent (ADR 0013)", () => {
    expect(ACTOR_LAMPORTS).toBe(0);
  });

  it("gives the producer enough test USDC for the 3 USDC mint fee and uses a 2% arrangement fee", () => {
    expect(DEMO_PRODUCER_USDC).toBeGreaterThanOrEqual(3_000_000n);
    expect(DEMO_ARRANGEMENT_BPS).toBe(200);
  });
});

describe("sample fields sit on farmland, not on Kostanay town blocks", () => {
  // Built-up Kostanay (with Tobol riverside districts) lies inside this box; the sample fields are east of it.
  const TOWN = { west: 63.52, east: 63.72, south: 53.13, north: 53.3 };
  it("keeps every vertex east of the town box and within 25 km of the centre", () => {
    for (const f of DEMO_FIELDS) {
      const ring = (f.geojson as { geometry: { coordinates: number[][][] } }).geometry.coordinates[0]!;
      for (const [lon, lat] of ring as [number, number][]) {
        expect(lon > TOWN.east || lon < TOWN.west || lat > TOWN.north || lat < TOWN.south).toBe(true);
        expect(Math.hypot((lon - 63.62) * 67, (lat - 53.21) * 111)).toBeLessThan(25);
      }
    }
  });

  it("draws the same two fields in the landing hero", async () => {
    const { HERO_FIELDS } = await import("../src/components/landing/hero-visual");
    expect(HERO_FIELDS.map((f) => f.name)).toEqual(DEMO_FIELDS.map((f) => f.name));
  });
});


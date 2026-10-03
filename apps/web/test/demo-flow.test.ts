import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_FIELDS } from "../src/lib/demo/fields";
import { ACTOR_LAMPORTS, demoSchedule, roleTopUp, sceneLine } from "../src/lib/demo/main-flow";
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

  it("funds fresh actors with a small amount of SOL", () => {
    expect(ACTOR_LAMPORTS).toBeLessThanOrEqual(50_000_000);
  });
});

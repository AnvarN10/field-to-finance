import { describe, expect, it } from "vitest";
import { parseTokenMetadata } from "../src/lib/chain/token-metadata";

function encode(name: string, symbol: string, uri: string): Uint8Array {
  const parts: number[] = [...new Array(64).fill(1)]; // update authority + mint
  for (const s of [name, symbol, uri]) {
    const b = new TextEncoder().encode(s);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, b.length, true);
    parts.push(...len, ...b);
  }
  parts.push(0, 0, 0, 0); // empty additional_metadata vec
  return Uint8Array.from(parts);
}

describe("parseTokenMetadata", () => {
  it("reads name, symbol and uri", () => {
    expect(parseTokenMetadata(encode("Wheat 2027", "WHEAT-2027", "https://f2f.example/api/instrument/7"))).toEqual({
      name: "Wheat 2027",
      symbol: "WHEAT-2027",
      uri: "https://f2f.example/api/instrument/7",
    });
  });

  it("fails on truncated data", () => {
    expect(() => parseTokenMetadata(encode("Wheat", "W", "u").slice(0, 70))).toThrow(/truncated/);
  });
});

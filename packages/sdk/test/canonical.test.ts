import { describe, expect, it } from "vitest";
import { canonicalJson, sha256, toHex } from "../src/canonical";

describe("canonicalJson", () => {
  it("sorts object keys recursively and keeps array order", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1], c: "x" } })).toBe('{"a":{"c":"x","d":[3,1]},"b":1}');
  });

  it("drops undefined properties and keeps null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("escapes strings exactly like JSON.stringify", () => {
    expect(canonicalJson({ s: 'He said "hi"\n' })).toBe(`{"s":${JSON.stringify('He said "hi"\n')}}`);
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/non-finite/);
  });
});

describe("sha256", () => {
  it("matches the FIPS 180-2 test vector", () => {
    expect(toHex(sha256("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

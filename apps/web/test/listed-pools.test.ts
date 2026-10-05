import { describe, expect, it } from "vitest";
import { listedPools, parseHiddenPoolIds } from "../src/lib/listed-pools";

const pool = (poolId: string) => ({ poolId });

describe("listed pools", () => {
  it("parses a comma-separated list of pool ids, ignoring blanks and junk", () => {
    expect([...parseHiddenPoolIds(" 1, 2,,x, 9 ")]).toEqual(["1", "2", "9"]);
    expect(parseHiddenPoolIds(undefined).size).toBe(0);
  });

  it("hides the listed pools and keeps the rest in order", () => {
    const pools = [pool("9"), pool("8"), pool("2")];
    expect(listedPools(pools, parseHiddenPoolIds("2,9")).map((p) => p.poolId)).toEqual(["8"]);
  });

  it("lists everything when nothing is hidden", () => {
    expect(listedPools([pool("1")], parseHiddenPoolIds("")).length).toBe(1);
  });
});

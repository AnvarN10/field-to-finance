import { describe, expect, it } from "vitest";
import { statementCsv } from "../src/lib/statement";

describe("statementCsv", () => {
  it("writes a header and CRLF rows", () => {
    const csv = statementCsv([{ date: "2026-10-05", type: "Subscribe", pool: "WHT27-1", amountUsd: "100000.00", tokens: "1", signature: "sig" }]);
    expect(csv).toBe("Date,Type,Pool,Amount (USD),Tokens,Transaction\r\n2026-10-05,Subscribe,WHT27-1,100000.00,1,sig\r\n");
  });
  it("quotes commas and quotes and neutralizes formula prefixes", () => {
    const csv = statementCsv([{ date: "d", type: '=HYPERLINK("x")', pool: "a,b", amountUsd: "-1", tokens: "+2", signature: "@s" }]);
    expect(csv.split("\r\n")[1]).toBe(`d,"'=HYPERLINK(""x"")","a,b",'-1,'+2,'@s`);
  });
});

import { describe, expect, it } from "vitest";
import { actionLabel, auditDetail } from "../src/lib/audit-labels";
import { plural } from "../src/lib/format";

describe("audit labels", () => {
  it("names actions in sentence case, and still reads an unknown code as words", () => {
    expect(actionLabel("document.reject")).toBe("Rejected a document");
    expect(actionLabel("application.advance")).toBe("Moved the application");
    expect(actionLabel("tx.subscribe")).toBe("Subscribed");
    expect(actionLabel("pool.set_rule")).toBe("Pool set rule");
  });

  it("turns payload codes into document and status names", () => {
    expect(auditDetail({ kind: "land_act", note: "The scan is missing page 2" })).toBe("Land-use right · Note: The scan is missing page 2");
    expect(auditDetail({ from: "submitted", to: "documents_review" })).toBe("Submitted to Document review");
    expect(auditDetail({ role: "investor" })).toBe("Investor");
    expect(auditDetail({ project: "3HRSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxdaM9" })).toMatch(/^Project: 3HRS…daM9$/);
  });

  it("pluralises counts", () => {
    expect(plural(1, "field")).toBe("1 field");
    expect(plural(2, "field")).toBe("2 fields");
    expect(plural(0, "project")).toBe("0 projects");
  });
});
